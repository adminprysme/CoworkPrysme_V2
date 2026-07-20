import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Building } from "@coworkprysme/db";
import {
  connectMongo,
  getBuildingModel,
  getClientAccountModel,
  getReservationModel,
} from "@coworkprysme/db";
import { BOOKING_CONFIRM_ERROR_CODES } from "@coworkprysme/shared";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { InvoicePdfService } from "@coworkprysme/invoice-pdf";
import { MailService, type MailAttachment } from "../mail/mail.service.js";
import { resolveBookingNotificationRecipients } from "../mail/resolve-booking-notification-recipients.js";
import {
  buildingToEmailAccess,
  renderAccountCreatedEmail,
  renderBankTransferExpiredEmail,
  renderBankTransferInstructionsEmail,
  renderBankTransferReminderEmail,
  renderBookingConfirmationEmail,
  renderStaffBookingNotificationEmail,
  type BookingConfirmationBuildingAccess,
} from "../mail/templates/booking-emails.js";

type BuildingLean = Building & { _id: Types.ObjectId };

export interface BookingEmailPricingLine {
  label: string;
  qty: number;
  totalTTC: number;
}

export interface BookingEmailVatLine {
  rate: number;
  baseHT: number;
  vat: number;
}

@Injectable()
export class BookingEmailsService {
  private readonly logger = new Logger(BookingEmailsService.name);

  constructor(
    private readonly mail: MailService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  async resolveBuildingAccess(
    buildingId: Types.ObjectId | string,
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
  async sendClientConfirmationEmails(input: {
    clientEmail: string;
    isNewAccount: boolean;
    reservationReference: string;
    invoiceReference: string;
    spaceName: string;
    startAt: Date | string;
    endAt: Date | string;
    totalTTC: number;
    lines: BookingEmailPricingLine[];
    vatBreakdown: BookingEmailVatLine[];
    building: BookingConfirmationBuildingAccess;
  }) {
    const clientEmail = input.clientEmail.trim().toLowerCase();

    const bookingEmail = renderBookingConfirmationEmail({
      reservationReference: input.reservationReference,
      invoiceReference: input.invoiceReference,
      spaceName: input.spaceName,
      startAt: new Date(input.startAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      endAt: new Date(input.endAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      totalTTC: input.totalTTC,
      lines: input.lines,
      vatBreakdown: input.vatBreakdown,
      building: input.building,
    });

    const attachments = await this.invoicePdfAttachment(input.invoiceReference);

    // Permanent rule: building contact email is display-only, never a send recipient.
    await this.mail.sendMail({
      to: clientEmail,
      subject: bookingEmail.subject,
      html: bookingEmail.html,
      attachments,
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

  async sendBankTransferInstructionsEmails(input: {
    clientEmail: string;
    isNewAccount: boolean;
    reservationReference: string;
    invoiceReference: string;
    spaceName: string;
    startAt: Date | string;
    endAt: Date | string;
    amountCents: number;
    expiresAt: Date;
    rib: { iban: string; bic: string; accountHolder: string; bankName?: string };
    transferLabel: string;
    building: BookingConfirmationBuildingAccess;
  }) {
    const clientEmail = input.clientEmail.trim().toLowerCase();
    const expiresAtLabel = input.expiresAt.toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
    });
    const email = renderBankTransferInstructionsEmail({
      reservationReference: input.reservationReference,
      invoiceReference: input.invoiceReference,
      spaceName: input.spaceName,
      startAt: new Date(input.startAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      endAt: new Date(input.endAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      amountCents: input.amountCents,
      expiresAtLabel,
      iban: input.rib.iban,
      bic: input.rib.bic,
      accountHolder: input.rib.accountHolder,
      bankName: input.rib.bankName,
      transferLabel: input.transferLabel,
      building: input.building,
    });

    const attachments = await this.invoicePdfAttachment(input.invoiceReference);

    await this.mail.sendMail({
      to: clientEmail,
      subject: email.subject,
      html: email.html,
      attachments,
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

  async sendBankTransferReminderEmail(input: {
    clientEmail: string;
    reservationReference: string;
    invoiceReference: string;
    spaceName: string;
    startAt: Date | string;
    endAt: Date | string;
    amountCents: number;
    expiresAt: Date;
    rib: { iban: string; bic: string; accountHolder: string; bankName?: string };
    transferLabel: string;
    tier: "j2" | "j4" | "j6";
    building: BookingConfirmationBuildingAccess;
  }) {
    const clientEmail = input.clientEmail.trim().toLowerCase();
    const expiresAtLabel = input.expiresAt.toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
    });
    const email = renderBankTransferReminderEmail({
      reservationReference: input.reservationReference,
      invoiceReference: input.invoiceReference,
      spaceName: input.spaceName,
      startAt: new Date(input.startAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      endAt: new Date(input.endAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      amountCents: input.amountCents,
      expiresAtLabel,
      iban: input.rib.iban,
      bic: input.rib.bic,
      accountHolder: input.rib.accountHolder,
      bankName: input.rib.bankName,
      transferLabel: input.transferLabel,
      building: input.building,
      tier: input.tier,
    });
    // Phase 2: reminders intentionally have no PDF attachment.
    await this.mail.sendMail({
      to: clientEmail,
      subject: email.subject,
      html: email.html,
    });
  }

  async sendBankTransferExpiredEmail(input: {
    clientEmail: string;
    reservationReference: string;
    spaceName: string;
  }) {
    const clientEmail = input.clientEmail.trim().toLowerCase();
    const email = renderBankTransferExpiredEmail({
      reservationReference: input.reservationReference,
      spaceName: input.spaceName,
    });
    await this.mail.sendMail({
      to: clientEmail,
      subject: email.subject,
      html: email.html,
    });
  }

  /**
   * Staff notification — recipients ONLY via resolveBookingNotificationRecipients.
   * Never uses buildings.email as SMTP destination. No PDF (staff uses gestion UI).
   */
  async sendStaffBookingNotifications(input: {
    buildingId: string;
    clientEmail: string;
    clientName: string | null;
    reservationReference: string;
    invoiceReference: string;
    spaceName: string;
    buildingName: string;
    startAt: Date | string;
    endAt: Date | string;
    totalTTC: number;
    paymentMethod: "card" | "bank_transfer";
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

  /**
   * After card payment succeeds: load booking context and send deferred emails.
   * Called only when the reservation actually transitioned to confirmed.
   */
  async sendEmailsAfterCardPayment(input: {
    reservationId: Types.ObjectId | string;
    invoiceReference: string;
  }): Promise<void> {
    await connectMongo();
    const Reservation = await getReservationModel();
    const ClientAccount = await getClientAccountModel();

    const reservation = await Reservation.findById(input.reservationId).lean().exec();
    if (!reservation) {
      this.logger.error(
        `Cannot send card-payment emails: reservation ${input.reservationId} not found`,
      );
      return;
    }

    if (!reservation.clientAccountId) {
      this.logger.error(
        `Cannot send card-payment emails: reservation ${reservation.reference} has no clientAccountId`,
      );
      return;
    }

    const account = await ClientAccount.findById(reservation.clientAccountId).lean().exec();
    if (!account?.email) {
      this.logger.error(
        `Cannot send card-payment emails: client account missing for ${reservation.reference}`,
      );
      return;
    }

    const reservationCount = await Reservation.countDocuments({
      clientAccountId: reservation.clientAccountId,
    }).exec();
    const accountCreatedMs = new Date(account.createdAt).getTime();
    const reservationCreatedMs = new Date(reservation.createdAt).getTime();
    const isNewAccount =
      reservationCount === 1 && Math.abs(accountCreatedMs - reservationCreatedMs) < 10 * 60 * 1000;

    const building = await this.resolveBuildingAccess(reservation.buildingId);
    const clientName = null; // identity lives on cardex; optional for staff mail

    await this.sendClientConfirmationEmails({
      clientEmail: account.email,
      isNewAccount,
      reservationReference: reservation.reference,
      invoiceReference: input.invoiceReference,
      spaceName: reservation.spaceSnapshot.name,
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      totalTTC: reservation.pricing.totalTTC,
      lines: [
        {
          label: reservation.spaceSnapshot.name,
          qty: 1,
          totalTTC: reservation.pricing.totalTTC,
        },
      ],
      vatBreakdown: [
        {
          rate: 20,
          baseHT: reservation.pricing.subtotalHT,
          vat: reservation.pricing.totalVAT,
        },
      ],
      building,
    });

    await this.sendStaffBookingNotifications({
      buildingId: reservation.buildingId.toString(),
      clientEmail: account.email,
      clientName,
      reservationReference: reservation.reference,
      invoiceReference: input.invoiceReference,
      spaceName: reservation.spaceSnapshot.name,
      buildingName: building.name,
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      totalTTC: reservation.pricing.totalTTC,
      paymentMethod: "card",
    });
  }

  /** Best-effort PDF attach — email still sends if generation fails. */
  private async invoicePdfAttachment(
    invoiceReference: string,
  ): Promise<MailAttachment[] | undefined> {
    try {
      const { pdf, model } = await this.invoicePdf.generatePdfForInvoiceReference(invoiceReference);
      return [
        {
          filename: `${model.invoiceReference}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ];
    } catch (error) {
      this.logger.error(`Invoice PDF attachment failed for ${invoiceReference}: ${String(error)}`);
      return undefined;
    }
  }
}
