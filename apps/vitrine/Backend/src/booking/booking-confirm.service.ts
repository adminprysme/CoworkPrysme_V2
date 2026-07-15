import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Service, Space } from "@coworkprysme/db";
import {
  confirmBookingCheckout,
  connectMongo,
  EmailAlreadyRegisteredError,
  getDiscountCodeModel,
  getServiceModel,
  InvalidCredentialsError,
  LockMismatchError,
  LockNotAvailableError,
  ReservationOverlapError,
} from "@coworkprysme/db";
import {
  BOOKING_CONFIRM_ERROR_CODES,
  BookingConfirmResponseSchema,
  PRIVACY_POLICY_VERSION,
  type BookingConfirmRequest,
  type BookingPriceServiceInput,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { MailService } from "../mail/mail.service.js";
import {
  renderAccountCreatedEmail,
  renderBookingConfirmationEmail,
} from "../mail/templates/booking-emails.js";
import { AvailabilityService } from "./availability.service.js";
import { BookingPriceService } from "./booking-price.service.js";
import { toObjectId } from "./object-id.util.js";

type ServiceLean = Service & { _id: Types.ObjectId };
type SpaceLean = Space & { _id: Types.ObjectId };

const CARD_PAYMENT_STUB_MESSAGE =
  "Le paiement par carte sera bientôt disponible — votre réservation est enregistrée, vous recevrez une facture proforma en attendant.";

@Injectable()
export class BookingConfirmService {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly bookingPrice: BookingPriceService,
    private readonly mail: MailService,
  ) {}

  private async resolveDiscountCodeId(code?: string) {
    if (!code) {
      return undefined;
    }

    await connectMongo();
    const DiscountCode = await getDiscountCodeModel();
    const discountCode = await DiscountCode.findOne({ code: code.trim().toUpperCase() })
      .select({ _id: 1 })
      .lean()
      .exec();
    return discountCode?._id;
  }

  private async buildServiceSnapshots(
    serviceInputs: readonly BookingPriceServiceInput[],
  ): Promise<ReservationServiceSnapshot[]> {
    if (serviceInputs.length === 0) {
      return [];
    }

    await connectMongo();
    const Service = await getServiceModel();
    const serviceIds = [...new Set(serviceInputs.map((entry) => entry.serviceId))].map(toObjectId);
    const services = await Service.find({ _id: { $in: serviceIds } })
      .lean()
      .exec();
    const servicesById = new Map(
      (services as ServiceLean[]).map((service) => [service._id.toString(), service]),
    );

    return serviceInputs.map((entry) => {
      const service = servicesById.get(entry.serviceId);
      if (!service) {
        throw new NotFoundException({
          code: BOOKING_CONFIRM_ERROR_CODES.VALIDATION_ERROR,
          message: "Service indisponible",
        });
      }

      return {
        serviceId: service._id,
        label: service.label,
        qty: entry.qty,
        unitPriceHT: service.priceHT,
        vatRate: service.vatRate,
      };
    });
  }

  private mapConfirmError(error: unknown): never {
    if (error instanceof LockNotAvailableError) {
      throw new ConflictException({
        code: BOOKING_CONFIRM_ERROR_CODES.LOCK_ALREADY_CONSUMED,
        message: "Ce créneau n'est plus verrouillé. Relancez une recherche.",
      });
    }
    if (error instanceof LockMismatchError) {
      throw new ConflictException({
        code: BOOKING_CONFIRM_ERROR_CODES.LOCK_MISMATCH,
        message: "Le verrou ne correspond pas à la réservation demandée.",
      });
    }
    if (error instanceof ReservationOverlapError) {
      throw new ConflictException({
        code: BOOKING_CONFIRM_ERROR_CODES.SLOT_OVERLAP,
        message: "Ce créneau vient d'être réservé par quelqu'un d'autre. Relancez une recherche.",
      });
    }
    if (error instanceof InvalidCredentialsError) {
      throw new UnauthorizedException({
        code: BOOKING_CONFIRM_ERROR_CODES.INVALID_CREDENTIALS,
        message: "Email ou mot de passe incorrect",
      });
    }
    if (error instanceof EmailAlreadyRegisteredError) {
      throw new ConflictException({
        code: BOOKING_CONFIRM_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
        message: "Un compte existe déjà avec cette adresse email. Connectez-vous.",
      });
    }
    throw error;
  }

  async confirm(input: BookingConfirmRequest) {
    const space = await this.availability.getSpaceById(input.spaceId);
    if (!space) {
      throw new NotFoundException({
        code: BOOKING_CONFIRM_ERROR_CODES.VALIDATION_ERROR,
        message: "Espace introuvable",
      });
    }

    const pricing = await this.bookingPrice.computePrice({
      spaceId: input.spaceId,
      startAt: input.startAt,
      endAt: input.endAt,
      durationClass: input.durationClass,
      services: input.services,
      discountCode: input.discountCode,
    });

    const now = new Date();
    const services = await this.buildServiceSnapshots(input.services);
    const discountCodeId = await this.resolveDiscountCodeId(input.discountCode);

    let result;
    try {
      result = await confirmBookingCheckout({
        lockId: input.lockId,
        sessionId: input.sessionId,
        spaceId: toObjectId(input.spaceId),
        buildingId: (space as SpaceLean).buildingId,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        durationClass: input.durationClass,
        partySize: input.partySize,
        reservationType: (space as SpaceLean).type,
        spaceSnapshot: {
          name: space.name,
          type: space.type,
        },
        services,
        discountCodeId,
        accountMode: input.accountMode,
        email: input.email,
        password: input.password,
        identity: input.identity,
        privacyPolicyVersion: input.accountMode === "new" ? PRIVACY_POLICY_VERSION : undefined,
        cgvAcceptedAt: now,
        withdrawalAcknowledgedAt: now,
        paymentMethod: input.paymentMethod,
        pricing,
      });
    } catch (error) {
      this.mapConfirmError(error);
    }

    await this.sendConfirmationEmails({
      email: result.clientEmail,
      isNewAccount: result.isNewAccount,
      reservationReference: result.reservation.reference,
      invoiceReference: result.invoiceReference,
      spaceName: space.name,
      startAt: input.startAt,
      endAt: input.endAt,
      pricing,
    });

    return BookingConfirmResponseSchema.parse({
      reservationReference: result.reservation.reference,
      invoiceReference: result.invoiceReference,
      paymentMethod: input.paymentMethod,
      cardPaymentStubMessage:
        input.paymentMethod === "card" ? CARD_PAYMENT_STUB_MESSAGE : undefined,
    });
  }

  private async sendConfirmationEmails(input: {
    email: string;
    isNewAccount: boolean;
    reservationReference: string;
    invoiceReference: string;
    spaceName: string;
    startAt: string;
    endAt: string;
    pricing: Awaited<ReturnType<BookingPriceService["computePrice"]>>;
  }) {
    const bookingEmail = renderBookingConfirmationEmail({
      reservationReference: input.reservationReference,
      invoiceReference: input.invoiceReference,
      spaceName: input.spaceName,
      startAt: new Date(input.startAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      endAt: new Date(input.endAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      totalTTC: input.pricing.totalTTC,
      lines: input.pricing.lines.map((line) => ({
        label: line.label,
        qty: line.qty,
        totalTTC: line.totalTTC,
      })),
      vatBreakdown: input.pricing.vatBreakdown,
    });

    await this.mail.sendMail({
      to: input.email,
      subject: bookingEmail.subject,
      html: bookingEmail.html,
    });

    if (input.isNewAccount) {
      const accountEmail = renderAccountCreatedEmail({ email: input.email });
      await this.mail.sendMail({
        to: input.email,
        subject: accountEmail.subject,
        html: accountEmail.html,
      });
    }
  }
}

type ReservationServiceSnapshot = {
  serviceId: Types.ObjectId;
  label: string;
  qty: number;
  unitPriceHT: number;
  vatRate: number;
};
