import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Building, Service, Space } from "@coworkprysme/db";
import {
  confirmBookingCheckout,
  connectMongo,
  EmailAlreadyRegisteredError,
  getBuildingModel,
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
import { resolveBookingNotificationRecipients } from "../mail/resolve-booking-notification-recipients.js";
import {
  buildingToEmailAccess,
  renderAccountCreatedEmail,
  renderBookingConfirmationEmail,
  renderStaffBookingNotificationEmail,
  type BookingConfirmationBuildingAccess,
} from "../mail/templates/booking-emails.js";
import { AvailabilityService } from "./availability.service.js";
import { BookingPriceService } from "./booking-price.service.js";
import { toObjectId } from "./object-id.util.js";

type ServiceLean = Service & { _id: Types.ObjectId };
type SpaceLean = Space & { _id: Types.ObjectId };
type BuildingLean = Building & { _id: Types.ObjectId };

@Injectable()
export class BookingConfirmService {
  private readonly logger = new Logger(BookingConfirmService.name);

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

    const buildingAccess = await this.resolveBuildingAccess((space as SpaceLean).buildingId);
    const buildingId = (space as SpaceLean).buildingId.toString();
    const clientName = input.identity
      ? `${input.identity.firstName} ${input.identity.lastName}`.trim()
      : null;

    await this.sendConfirmationEmails({
      clientEmail: result.clientEmail,
      isNewAccount: result.isNewAccount,
      reservationReference: result.reservation.reference,
      invoiceReference: result.invoiceReference,
      spaceName: space.name,
      startAt: input.startAt,
      endAt: input.endAt,
      pricing,
      building: buildingAccess,
    });

    await this.sendStaffBookingNotifications({
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

    return BookingConfirmResponseSchema.parse({
      reservationReference: result.reservation.reference,
      invoiceReference: result.invoiceReference,
      paymentMethod: input.paymentMethod,
      reservationStatus: result.reservation.status,
    });
  }

  private async resolveBuildingAccess(
    buildingId: Types.ObjectId,
  ): Promise<BookingConfirmationBuildingAccess> {
    await connectMongo();
    const Building = await getBuildingModel();
    const building = (await Building.findById(buildingId).lean().exec()) as BuildingLean | null;
    if (!building) {
      throw new NotFoundException({
        code: BOOKING_CONFIRM_ERROR_CODES.VALIDATION_ERROR,
        message: "Bâtiment introuvable",
      });
    }
    return buildingToEmailAccess(building);
  }

  /**
   * Client transactional emails only.
   * `building.contactEmail` may appear in the HTML body (display) but must never be used as SMTP `to`.
   */
  private async sendConfirmationEmails(input: {
    clientEmail: string;
    isNewAccount: boolean;
    reservationReference: string;
    invoiceReference: string;
    spaceName: string;
    startAt: string;
    endAt: string;
    pricing: Awaited<ReturnType<BookingPriceService["computePrice"]>>;
    building: BookingConfirmationBuildingAccess;
  }) {
    const clientEmail = input.clientEmail.trim().toLowerCase();

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
      building: input.building,
    });

    // Permanent rule: building contact email is display-only, never a send recipient.
    await this.mail.sendMail({
      to: clientEmail,
      subject: bookingEmail.subject,
      html: bookingEmail.html,
    });

    if (input.isNewAccount) {
      const accountEmail = renderAccountCreatedEmail({ email: clientEmail });
      await this.mail.sendMail({
        to: clientEmail,
        subject: accountEmail.subject,
        html: accountEmail.html,
      });
    }
  }

  /**
   * Staff notification — recipients ONLY via resolveBookingNotificationRecipients.
   * Never uses buildings.email as SMTP destination.
   */
  private async sendStaffBookingNotifications(input: {
    buildingId: string;
    clientEmail: string;
    clientName: string | null;
    reservationReference: string;
    invoiceReference: string;
    spaceName: string;
    buildingName: string;
    startAt: string;
    endAt: string;
    totalTTC: number;
    paymentMethod: "proforma" | "card";
  }) {
    const recipients = await resolveBookingNotificationRecipients(input.buildingId);
    if (recipients.length === 0) {
      this.logger.warn(
        `aucun destinataire de notification configuré pour ce bâtiment (${input.buildingId})`,
      );
      return;
    }

    const startAt = new Date(input.startAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    const endAt = new Date(input.endAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    const staffEmail = renderStaffBookingNotificationEmail({
      reservationReference: input.reservationReference,
      invoiceReference: input.invoiceReference,
      spaceName: input.spaceName,
      buildingName: input.buildingName,
      startAt,
      endAt,
      totalTTC: input.totalTTC,
      clientEmail: input.clientEmail,
      clientName: input.clientName,
      paymentMethod: input.paymentMethod,
    });

    for (const to of recipients) {
      await this.mail.sendMail({
        to,
        subject: staffEmail.subject,
        html: staffEmail.html,
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
