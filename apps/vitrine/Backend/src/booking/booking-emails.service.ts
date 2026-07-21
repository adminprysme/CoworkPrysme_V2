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
import { MailService, type MailAttachment, type SendMailResult } from "../mail/mail.service.js";
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
import {
  writeBookingEmailDeliveryAudit,
  type BookingEmailAction,
} from "./booking-email-delivery-audit.js";

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
    reservationId?: Types.ObjectId | string;
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

    const { attachments, pdfAttached } = await this.invoicePdfAttachment(input.invoiceReference);

    // Permanent rule: building contact email is display-only, never a send recipient.
    await this.sendAndAudit({
      action: "booking.email.card_confirmation",
      to: clientEmail,
      subject: bookingEmail.subject,
      html: bookingEmail.html,
      attachments,
      pdfAttached,
      reservationId: input.reservationId,
      reservationReference: input.reservationReference,
      invoiceReference: input.invoiceReference,
    });

    if (input.isNewAccount) {
      const accountEmail = renderAccountCreatedEmail({ email: clientEmail });
      await this.sendAndAudit({
        action: "booking.email.account_created",
        to: clientEmail,
        subject: accountEmail.subject,
        html: accountEmail.html,
        reservationId: input.reservationId,
        reservationReference: input.reservationReference,
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
    reservationId?: Types.ObjectId | string;
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

    const { attachments, pdfAttached } = await this.invoicePdfAttachment(input.invoiceReference);

    await this.sendAndAudit({
      action: "booking.email.bank_transfer_instructions",
      to: clientEmail,
      subject: email.subject,
      html: email.html,
      attachments,
      pdfAttached,
      reservationId: input.reservationId,
      reservationReference: input.reservationReference,
      invoiceReference: input.invoiceReference,
    });

    if (input.isNewAccount) {
      const accountEmail = renderAccountCreatedEmail({ email: clientEmail });
      await this.sendAndAudit({
        action: "booking.email.account_created",
        to: clientEmail,
        subject: accountEmail.subject,
        html: accountEmail.html,
        reservationId: input.reservationId,
        reservationReference: input.reservationReference,
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
    reservationId?: Types.ObjectId | string;
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
    await this.sendAndAudit({
      action: "booking.email.bank_transfer_reminder",
      to: clientEmail,
      subject: email.subject,
      html: email.html,
      pdfAttached: false,
      reservationId: input.reservationId,
      reservationReference: input.reservationReference,
      invoiceReference: input.invoiceReference,
    });
  }

  async sendBankTransferExpiredEmail(input: {
    clientEmail: string;
    reservationReference: string;
    spaceName: string;
    reservationId?: Types.ObjectId | string;
  }) {
    const clientEmail = input.clientEmail.trim().toLowerCase();
    const email = renderBankTransferExpiredEmail({
      reservationReference: input.reservationReference,
      spaceName: input.spaceName,
    });
    await this.sendAndAudit({
      action: "booking.email.bank_transfer_expired",
      to: clientEmail,
      subject: email.subject,
      html: email.html,
      reservationId: input.reservationId,
      reservationReference: input.reservationReference,
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
    reservationId?: Types.ObjectId | string;
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
      await this.sendAndAudit({
        action: "booking.email.staff_notification",
        to,
        subject: staffEmail.subject,
        html: staffEmail.html,
        pdfAttached: false,
        reservationId: input.reservationId,
        reservationReference: input.reservationReference,
        invoiceReference: input.invoiceReference,
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
      reservationId: reservation._id,
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
      reservationId: reservation._id,
    });
  }

  private async sendAndAudit(input: {
    action: BookingEmailAction;
    to: string;
    subject: string;
    html: string;
    attachments?: MailAttachment[];
    pdfAttached?: boolean;
    reservationId?: Types.ObjectId | string;
    reservationReference?: string;
    invoiceReference?: string;
  }): Promise<SendMailResult> {
    const mailResult = await this.mail.sendMail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    });
    try {
      await writeBookingEmailDeliveryAudit({
        action: input.action,
        reservationId: input.reservationId,
        reservationReference: input.reservationReference,
        invoiceReference: input.invoiceReference,
        mailResult,
        pdfAttached: input.pdfAttached,
        to: input.to,
      });
    } catch (error) {
      this.logger.error(
        `Failed to write email delivery audit action=${input.action}: ${String(error)}`,
      );
    }
    return mailResult;
  }

  /** Best-effort PDF attach — email still sends if generation fails (audited via pdfAttached). */
  private async invoicePdfAttachment(
    invoiceReference: string,
  ): Promise<{ attachments: MailAttachment[] | undefined; pdfAttached: boolean }> {
    try {
      const { pdf, model } = await this.invoicePdf.generatePdfForInvoiceReference(invoiceReference);
      return {
        attachments: [
          {
            filename: `${model.invoiceReference}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          },
        ],
        pdfAttached: true,
      };
    } catch (error) {
      this.logger.error(`Invoice PDF attachment failed for ${invoiceReference}: ${String(error)}`);
      return { attachments: undefined, pdfAttached: false };
    }
  }
}
