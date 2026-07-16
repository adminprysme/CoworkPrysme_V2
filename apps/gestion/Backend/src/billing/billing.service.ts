import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { InvoiceDocument } from "@coworkprysme/db";
import type { ReservationDocument } from "@coworkprysme/db";
import {
  applyBankTransferPayment,
  confirmReservationAfterPayment,
  connectMongo,
  getBuildingModel,
  getClientAccountModel,
  getInvoiceModel,
  getReservationModel,
} from "@coworkprysme/db";
import type {
  BankTransferPendingLookupResponse,
  MarkBankTransferReceivedResponse,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { MailService } from "../mail/mail.service.js";

interface TransferPair {
  reservation: ReservationDocument;
  invoice: InvoiceDocument;
  clientEmail: string | null;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly mail: MailService) {}

  async lookupPendingTransfer(reference: string): Promise<BankTransferPendingLookupResponse> {
    const pair = await this.findTransferPair(reference);
    if (!pair) {
      return {
        found: false,
        message: "Aucune réservation / facture trouvée pour cette référence.",
      };
    }

    const { reservation, invoice, clientEmail } = pair;
    const base = {
      found: true as const,
      reservationReference: reservation.reference,
      invoiceId: invoice._id.toString(),
      invoiceReference: invoice.reference,
      reservationStatus: reservation.status,
      awaitingPaymentMethod: reservation.awaitingPaymentMethod,
      amountDueCents: invoice.totals.balanceDue,
      spaceName: reservation.spaceSnapshot.name,
      startAt: new Date(reservation.startAt).toISOString(),
      endAt: new Date(reservation.endAt).toISOString(),
      clientEmail: clientEmail ?? undefined,
    };

    if (
      reservation.status !== "awaiting_payment" ||
      reservation.awaitingPaymentMethod !== "bank_transfer"
    ) {
      return {
        ...base,
        message:
          reservation.status === "confirmed"
            ? "Cette réservation est déjà confirmée."
            : "Cette réservation n'est pas en attente de virement.",
      };
    }

    return base;
  }

  async markTransferReceivedByReference(
    reference: string,
    staffProfileId?: string,
  ): Promise<MarkBankTransferReceivedResponse> {
    const pair = await this.findTransferPair(reference);
    if (!pair) {
      throw new NotFoundException({
        message: "Aucune réservation / facture trouvée pour cette référence.",
      });
    }
    this.assertAwaitingBankTransfer(pair.reservation);
    return this.markTransferReceivedForPair(pair, staffProfileId);
  }

  async markTransferReceivedByInvoiceId(
    invoiceId: string,
    staffProfileId?: string,
  ): Promise<MarkBankTransferReceivedResponse> {
    await connectMongo();
    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findById(invoiceId).exec();
    if (!invoice?.reservationId) {
      throw new NotFoundException({ message: "Facture introuvable." });
    }
    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(invoice.reservationId).exec();
    if (!reservation) {
      throw new NotFoundException({ message: "Réservation liée introuvable." });
    }
    this.assertAwaitingBankTransfer(reservation);
    const clientEmail = await this.resolveClientEmail(reservation.clientAccountId?.toString());
    return this.markTransferReceivedForPair({ reservation, invoice, clientEmail }, staffProfileId);
  }

  private assertAwaitingBankTransfer(reservation: ReservationDocument) {
    if (
      reservation.status !== "awaiting_payment" ||
      reservation.awaitingPaymentMethod !== "bank_transfer"
    ) {
      throw new BadRequestException({
        message: "Cette réservation n'est pas en attente de virement.",
      });
    }
  }

  private async markTransferReceivedForPair(
    pair: TransferPair,
    staffProfileId?: string,
  ): Promise<MarkBankTransferReceivedResponse> {
    const amountReceived = pair.invoice.totals.balanceDue;
    if (!Number.isInteger(amountReceived) || amountReceived <= 0) {
      throw new BadRequestException({ message: "Aucun solde à encaisser sur cette facture." });
    }

    const paymentResult = await applyBankTransferPayment({
      invoiceId: pair.invoice._id,
      amountReceived,
      markedByStaffProfileId: staffProfileId,
    });

    const confirmed = await confirmReservationAfterPayment({
      reservationId: pair.reservation._id,
      reason: "bank_transfer_received",
    });

    if (confirmed.transitioned && pair.clientEmail) {
      await this.sendConfirmationEmail({
        clientEmail: pair.clientEmail,
        reservationReference: pair.reservation.reference,
        invoiceReference: paymentResult.invoice.reference,
        spaceName: pair.reservation.spaceSnapshot.name,
        startAt: pair.reservation.startAt,
        endAt: pair.reservation.endAt,
        totalTTC: pair.reservation.pricing.totalTTC,
        buildingId: pair.reservation.buildingId.toString(),
      });
    }

    this.logger.log(
      `Bank transfer marked received ref=${pair.reservation.reference} applied=${paymentResult.applied} transitioned=${confirmed.transitioned}`,
    );

    return {
      applied: paymentResult.applied,
      transitioned: confirmed.transitioned,
      reservationReference: pair.reservation.reference,
      invoiceReference: paymentResult.invoice.reference,
      reservationStatus: confirmed.reservation.status,
      paymentId: paymentResult.payment?._id.toString() ?? null,
      amountReceivedCents: amountReceived,
    };
  }

  private async findTransferPair(reference: string): Promise<TransferPair | null> {
    await connectMongo();
    const Reservation = await getReservationModel();
    const Invoice = await getInvoiceModel();
    const ref = reference.trim();

    let reservation = await Reservation.findOne({ reference: ref }).exec();
    let invoice = reservation
      ? await Invoice.findOne({ reservationId: reservation._id }).exec()
      : null;

    if (!reservation) {
      invoice = await Invoice.findOne({ reference: ref }).exec();
      if (invoice?.reservationId) {
        reservation = await Reservation.findById(invoice.reservationId).exec();
      }
    }

    if (!reservation || !invoice) {
      return null;
    }

    const clientEmail = await this.resolveClientEmail(reservation.clientAccountId?.toString());
    return { reservation, invoice, clientEmail };
  }

  private async resolveClientEmail(clientAccountId: string | undefined): Promise<string | null> {
    if (!clientAccountId) {
      return null;
    }
    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findById(clientAccountId)
      .select({ email: 1 })
      .lean()
      .exec();
    return account?.email?.trim().toLowerCase() || null;
  }

  private async sendConfirmationEmail(input: {
    clientEmail: string;
    reservationReference: string;
    invoiceReference: string;
    spaceName: string;
    startAt: Date;
    endAt: Date;
    totalTTC: number;
    buildingId: string;
  }) {
    const startAt = input.startAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    const endAt = input.endAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    const amount = `${(input.totalTTC / 100).toFixed(2).replace(".", ",")} €`;
    const accessPlanHtml = await this.renderFullAccessPlanHtml(input.buildingId);
    const html = `
      <p>Bonjour,</p>
      <p>Nous avons bien reçu votre virement. Votre réservation
      <strong>${escapeHtml(input.reservationReference)}</strong> est désormais
      <strong>confirmée</strong>.</p>
      <p><strong>${escapeHtml(input.spaceName)}</strong><br>
      Du ${escapeHtml(startAt)} au ${escapeHtml(endAt)}<br>
      Facture ${escapeHtml(input.invoiceReference)} — Montant ${escapeHtml(amount)}</p>
      ${accessPlanHtml}
      <p>Merci et à bientôt au Cowork Prysme.</p>
    `;
    await this.mail.sendMail({
      to: input.clientEmail,
      subject: `Réservation confirmée — ${input.reservationReference} — Cowork Prysme`,
      html,
    });
  }

  /** Full access plan — only after payment is confirmed (never on pre-payment emails). */
  private async renderFullAccessPlanHtml(buildingId: string): Promise<string> {
    await connectMongo();
    const Building = await getBuildingModel();
    const building = await Building.findById(buildingId).lean().exec();
    if (!building) {
      return "";
    }

    const locality = `${building.address.zip.trim()} ${building.address.city.trim()}`.trim();
    const addressFull = [building.address.street.trim(), locality].filter(Boolean).join(", ");
    const items: string[] = [`<li><strong>Adresse :</strong> ${escapeHtml(addressFull)}</li>`];

    const accessInfo = building.address.accessInfo?.trim();
    if (accessInfo) {
      items.push(
        `<li><strong>Instructions d'accès :</strong> ${escapeHtml(accessInfo).replaceAll("\n", "<br>")}</li>`,
      );
    }
    const buildingAccessCode = building.accessCode?.trim();
    if (buildingAccessCode) {
      items.push(`<li><strong>Code d'accès :</strong> ${escapeHtml(buildingAccessCode)}</li>`);
    }
    const conciergeAccessCode = building.concierge?.accessCode?.trim();
    if (conciergeAccessCode) {
      items.push(
        `<li><strong>Code conciergerie :</strong> ${escapeHtml(conciergeAccessCode)}</li>`,
      );
    }
    const conciergeUrl = building.concierge?.url?.trim();
    if (conciergeUrl) {
      items.push(
        `<li><strong>Conciergerie :</strong> <a href="${escapeHtml(conciergeUrl)}">${escapeHtml(conciergeUrl)}</a></li>`,
      );
    }

    return `
      <p><strong>Plan d'accès — ${escapeHtml(building.name)}</strong></p>
      <ul style="padding-left:20px;margin:8px 0 16px;">
        ${items.join("\n        ")}
      </ul>
    `;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
