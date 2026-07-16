import {
  ConflictException,
  Injectable,
  Logger,
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
import { AvailabilityService } from "./availability.service.js";
import { BookingEmailsService } from "./booking-emails.service.js";
import { BookingPriceService } from "./booking-price.service.js";
import { toObjectId } from "./object-id.util.js";

type ServiceLean = Service & { _id: Types.ObjectId };
type SpaceLean = Space & { _id: Types.ObjectId };

@Injectable()
export class BookingConfirmService {
  private readonly logger = new Logger(BookingConfirmService.name);

  constructor(
    private readonly availability: AvailabilityService,
    private readonly bookingPrice: BookingPriceService,
    private readonly bookingEmails: BookingEmailsService,
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
        marketingCommunicationsAccepted:
          input.accountMode === "new" ? input.marketingCommunicationsAccepted : undefined,
        cgvAcceptedAt: now,
        withdrawalAcknowledgedAt: now,
        paymentMethod: input.paymentMethod,
        pricing,
      });
    } catch (error) {
      this.mapConfirmError(error);
    }

    // Card: emails only after payment_intent.succeeded. Proforma: send now.
    if (input.paymentMethod === "proforma") {
      const buildingAccess = await this.bookingEmails.resolveBuildingAccess(
        (space as SpaceLean).buildingId,
      );
      const buildingId = (space as SpaceLean).buildingId.toString();
      const clientName = input.identity
        ? `${input.identity.firstName} ${input.identity.lastName}`.trim()
        : null;

      await this.bookingEmails.sendClientConfirmationEmails({
        clientEmail: result.clientEmail,
        isNewAccount: result.isNewAccount,
        reservationReference: result.reservation.reference,
        invoiceReference: result.invoiceReference,
        spaceName: space.name,
        startAt: input.startAt,
        endAt: input.endAt,
        totalTTC: pricing.totalTTC,
        lines: pricing.lines.map((line) => ({
          label: line.label,
          qty: line.qty,
          totalTTC: line.totalTTC,
        })),
        vatBreakdown: pricing.vatBreakdown,
        building: buildingAccess,
      });

      await this.bookingEmails.sendStaffBookingNotifications({
        buildingId,
        clientEmail: result.clientEmail,
        clientName,
        reservationReference: result.reservation.reference,
        invoiceReference: result.invoiceReference,
        spaceName: space.name,
        buildingName: buildingAccess.name,
        startAt: input.startAt,
        endAt: input.endAt,
        totalTTC: pricing.totalTTC,
        paymentMethod: input.paymentMethod,
      });
    } else {
      this.logger.log(
        `Card checkout ${result.reservation.reference}: emails deferred until payment succeeds`,
      );
    }

    return BookingConfirmResponseSchema.parse({
      reservationReference: result.reservation.reference,
      invoiceReference: result.invoiceReference,
      paymentMethod: input.paymentMethod,
      reservationStatus: result.reservation.status,
    });
  }
}

type ReservationServiceSnapshot = {
  serviceId: Types.ObjectId;
  label: string;
  qty: number;
  unitPriceHT: number;
  vatRate: number;
};
