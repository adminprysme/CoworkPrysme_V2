import {
  BadRequestException,
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
  computeBankTransferExpiresAt,
  isBankTransferFullyEligible,
  PRIVACY_POLICY_VERSION,
  type BankTransferInstructions,
  type BookingConfirmRequest,
  type BookingPaymentMethod,
  type BookingPriceServiceInput,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { AvailabilityService } from "./availability.service.js";
import {
  loadBankTransferRibConfig,
  loadBankTransferThresholds,
  resolveAvailablePaymentMethods,
} from "./bank-transfer.config.js";
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

  /** Public payment-method availability for the tunnel (no RIB secrets). */
  getPaymentMethods(startAtIso: string): {
    paymentMethods: BookingPaymentMethod[];
    bankTransferAvailable: boolean;
    minLeadDays: number;
  } {
    return resolveAvailablePaymentMethods(new Date(startAtIso));
  }

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

  private assertBankTransferAllowed(
    startAt: Date,
    now: Date,
  ): {
    expiresAt: Date;
    rib: NonNullable<ReturnType<typeof loadBankTransferRibConfig>>;
  } {
    const rib = loadBankTransferRibConfig();
    if (!rib) {
      throw new BadRequestException({
        code: BOOKING_CONFIRM_ERROR_CODES.BANK_TRANSFER_NOT_CONFIGURED,
        message: "Le paiement par virement n'est pas disponible pour le moment.",
      });
    }
    const thresholds = loadBankTransferThresholds();
    if (
      !isBankTransferFullyEligible({
        startAt,
        now,
        minLeadDays: thresholds.minLeadDays,
        paymentWindowDays: thresholds.paymentWindowDays,
        safetyMarginDays: thresholds.safetyMarginDays,
      })
    ) {
      throw new BadRequestException({
        code: BOOKING_CONFIRM_ERROR_CODES.BANK_TRANSFER_NOT_ELIGIBLE,
        message: `Le virement bancaire n'est possible que pour les réservations dans au moins ${thresholds.minLeadDays} jours, avec une fenêtre de paiement suffisante.`,
      });
    }
    const expiry = computeBankTransferExpiresAt({
      issuedAt: now,
      startAt,
      paymentWindowDays: thresholds.paymentWindowDays,
      safetyMarginDays: thresholds.safetyMarginDays,
    });
    if (!expiry.ok) {
      throw new BadRequestException({
        code: BOOKING_CONFIRM_ERROR_CODES.BANK_TRANSFER_NOT_ELIGIBLE,
        message: "Le délai avant votre réservation est trop court pour un paiement par virement.",
      });
    }
    return { expiresAt: expiry.expiresAt, rib };
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
    const startAt = new Date(input.startAt);
    let bankTransferExpiresAt: Date | undefined;
    let bankTransferRib: ReturnType<typeof loadBankTransferRibConfig> = null;

    if (input.paymentMethod === "bank_transfer") {
      const allowed = this.assertBankTransferAllowed(startAt, now);
      bankTransferExpiresAt = allowed.expiresAt;
      bankTransferRib = allowed.rib;
    }

    const services = await this.buildServiceSnapshots(input.services);
    const discountCodeId = await this.resolveDiscountCodeId(input.discountCode);

    let result;
    try {
      result = await confirmBookingCheckout({
        lockId: input.lockId,
        sessionId: input.sessionId,
        spaceId: toObjectId(input.spaceId),
        buildingId: (space as SpaceLean).buildingId,
        startAt,
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
        clientKind: input.accountMode === "new" ? input.clientKind : undefined,
        address:
          input.accountMode === "new" && input.clientKind === "individual"
            ? input.address
              ? {
                  street: input.address.street,
                  zip: input.address.zip,
                  city: input.address.city,
                  country: input.address.country ?? "FR",
                }
              : undefined
            : undefined,
        company:
          input.accountMode === "new" && input.clientKind === "company" && input.company
            ? {
                legalName: input.company.legalName,
                siret: input.company.siret,
                vatNumber: input.company.vatNumber,
                billingAddress: {
                  street: input.company.billingAddress.street,
                  zip: input.company.billingAddress.zip,
                  city: input.company.billingAddress.city,
                  country: input.company.billingAddress.country ?? "FR",
                },
              }
            : undefined,
        privacyPolicyVersion: input.accountMode === "new" ? PRIVACY_POLICY_VERSION : undefined,
        marketingCommunicationsAccepted:
          input.accountMode === "new" ? input.marketingCommunicationsAccepted : undefined,
        cgvAcceptedAt: now,
        withdrawalAcknowledgedAt: now,
        paymentMethod: input.paymentMethod,
        pricing,
        awaitingPaymentExpiresAt: bankTransferExpiresAt,
      });
    } catch (error) {
      this.mapConfirmError(error);
    }

    let bankTransfer: BankTransferInstructions | undefined;

    // Bank transfer: RIB + staff emails at create. Card: deferred until webhook.
    if (input.paymentMethod === "bank_transfer" && bankTransferRib && bankTransferExpiresAt) {
      const buildingAccess = await this.bookingEmails.resolveBuildingAccess(
        (space as SpaceLean).buildingId,
      );
      const buildingId = (space as SpaceLean).buildingId.toString();
      const clientName = input.identity
        ? `${input.identity.firstName} ${input.identity.lastName}`.trim()
        : null;

      bankTransfer = {
        iban: bankTransferRib.iban,
        bic: bankTransferRib.bic,
        accountHolder: bankTransferRib.accountHolder,
        bankName: bankTransferRib.bankName,
        transferLabel: result.reservation.reference,
        amountCents: pricing.totalTTC,
        expiresAt: bankTransferExpiresAt.toISOString(),
      };

      await this.bookingEmails.sendBankTransferInstructionsEmails({
        clientEmail: result.clientEmail,
        isNewAccount: result.isNewAccount,
        reservationReference: result.reservation.reference,
        invoiceReference: result.invoiceReference,
        spaceName: space.name,
        startAt: input.startAt,
        endAt: input.endAt,
        amountCents: pricing.totalTTC,
        expiresAt: bankTransferExpiresAt,
        rib: bankTransferRib,
        transferLabel: result.reservation.reference,
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
      bankTransfer,
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
