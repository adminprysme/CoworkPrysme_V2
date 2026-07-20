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
  getQontoTransferCandidateModel,
  getReservationModel,
} from "@coworkprysme/db";
import type {
  BankTransferPendingLookupResponse,
  MarkBankTransferReceivedResponse,
  QontoTransferSuggestion,
} from "@coworkprysme/shared";
import { renderPaymentConfirmedEmail } from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { InvoicePdfService } from "@coworkprysme/invoice-pdf";
import { MailService } from "../mail/mail.service.js";

interface TransferPair {
  reservation: ReservationDocument;
  invoice: InvoiceDocument;
  clientEmail: string | null;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly mail: MailService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

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

    const qontoSuggestion = await this.findQontoSuggestion(reservation.reference);
    return qontoSuggestion ? { ...base, qontoSuggestion } : base;
  }

  async markTransferReceivedByReference(
    reference: string,
    staffProfileId?: string,
    qontoTxId?: string,
  ): Promise<MarkBankTransferReceivedResponse> {
    const pair = await this.findTransferPair(reference);
    if (!pair) {
      throw new NotFoundException({
        message: "Aucune réservation / facture trouvée pour cette référence.",
      });
    }
    this.assertAwaitingBankTransfer(pair.reservation);
    return this.markTransferReceivedForPair(pair, staffProfileId, qontoTxId);
  }

  async markTransferReceivedByInvoiceId(
    invoiceId: string,
    staffProfileId?: string,
    qontoTxId?: string,
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
    return this.markTransferReceivedForPair(
      { reservation, invoice, clientEmail },
      staffProfileId,
      qontoTxId,
    );
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
    qontoTxId?: string,
  ): Promise<MarkBankTransferReceivedResponse> {
    const amountReceived = pair.invoice.totals.balanceDue;
    if (!Number.isInteger(amountReceived) || amountReceived <= 0) {
      throw new BadRequestException({ message: "Aucun solde à encaisser sur cette facture." });
    }

    const normalizedQontoTxId = qontoTxId?.trim() || undefined;
    if (normalizedQontoTxId) {
      await this.assertQontoTxIdConfirmable(pair.reservation.reference, normalizedQontoTxId);
    }

    const paymentResult = await applyBankTransferPayment({
      invoiceId: pair.invoice._id,
      amountReceived,
      markedByStaffProfileId: staffProfileId,
      qontoTxId: normalizedQontoTxId,
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
      `Bank transfer marked received ref=${pair.reservation.reference} applied=${paymentResult.applied} transitioned=${confirmed.transitioned} qontoTxId=${normalizedQontoTxId ?? "none"}`,
    );

    return {
      applied: paymentResult.applied,
      transitioned: confirmed.transitioned,
      reservationReference: pair.reservation.reference,
      invoiceReference: paymentResult.invoice.reference,
      reservationStatus: confirmed.reservation.status,
      paymentId: paymentResult.payment?._id.toString() ?? null,
      amountReceivedCents: amountReceived,
      qontoTxId: paymentResult.payment?.reconciliation.qontoTxId ?? normalizedQontoTxId ?? null,
    };
  }

  private async assertQontoTxIdConfirmable(
    reservationReference: string,
    qontoTxId: string,
  ): Promise<void> {
    await connectMongo();
    const Candidate = await getQontoTransferCandidateModel();
    const candidate = await Candidate.findOne({ qontoTxId }).lean().exec();
    if (!candidate || candidate.consumedAt) {
      throw new BadRequestException({
        message: "Transaction Qonto introuvable ou déjà rapprochée.",
      });
    }
    if (candidate.reservationReference !== reservationReference) {
      throw new BadRequestException({
        message: "Cette transaction Qonto ne correspond pas à cette réservation.",
      });
    }
    if (candidate.matchStatus === "amount_mismatch") {
      throw new BadRequestException({
        message:
          "Montant Qonto différent du solde dû — rapprochement Qonto refusé. Utilisez l'encaissement manuel sans lier la transaction, ou corrigez le virement.",
      });
    }
    if (candidate.matchStatus !== "exact") {
      throw new BadRequestException({
        message: "Cette transaction Qonto n'est pas une correspondance exacte.",
      });
    }
  }

  private async findQontoSuggestion(
    reservationReference: string,
  ): Promise<QontoTransferSuggestion | undefined> {
    await connectMongo();
    const Candidate = await getQontoTransferCandidateModel();
    const candidate = await Candidate.findOne({
      reservationReference,
      consumedAt: { $exists: false },
      matchStatus: { $in: ["exact", "amount_mismatch"] },
    })
      .sort({ settledAt: -1, updatedAt: -1 })
      .lean()
      .exec();

    if (!candidate) {
      return undefined;
    }

    return {
      matchStatus: candidate.matchStatus as "exact" | "amount_mismatch",
      qontoTxId: candidate.qontoTxId,
      amountCents: candidate.amountCents,
      currency: candidate.currency || "EUR",
      settledAt: candidate.settledAt ? new Date(candidate.settledAt).toISOString() : null,
      observedLabel: candidate.observedLabel || undefined,
      reservationReference: candidate.reservationReference ?? reservationReference,
      amountDueCents: candidate.amountDueCents ?? 0,
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
    const building = await this.resolveBuildingAccessForEmail(input.buildingId);
    const email = renderPaymentConfirmedEmail({
      reservationReference: input.reservationReference,
      invoiceReference: input.invoiceReference,
      spaceName: input.spaceName,
      startAt,
      endAt,
      totalTTC: input.totalTTC,
      paymentMethod: "bank_transfer",
      building,
    });

    let attachments: Array<{ filename: string; content: Buffer; contentType?: string }> | undefined;
    try {
      const { pdf, model } = await this.invoicePdf.generatePdfForInvoiceReference(
        input.invoiceReference,
      );
      attachments = [
        {
          filename: `${model.invoiceReference}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ];
    } catch (error) {
      this.logger.error(
        `Invoice PDF attachment failed for ${input.invoiceReference}: ${String(error)}`,
      );
    }

    await this.mail.sendMail({
      to: input.clientEmail,
      subject: email.subject,
      html: email.html,
      attachments,
    });
  }

  private async resolveBuildingAccessForEmail(buildingId: string): Promise<{
    name: string;
    addressFull: string;
    accessInfo?: string | null;
    buildingAccessCode?: string | null;
    conciergeAccessCode?: string | null;
    conciergeUrl?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  }> {
    await connectMongo();
    const Building = await getBuildingModel();
    const building = await Building.findById(buildingId).lean().exec();
    if (!building) {
      return {
        name: "Cowork Prysme",
        addressFull: "",
      };
    }

    const locality = `${building.address.zip.trim()} ${building.address.city.trim()}`.trim();
    const addressFull = [building.address.street.trim(), locality].filter(Boolean).join(", ");
    return {
      name: building.name.trim(),
      addressFull,
      accessInfo: building.address.accessInfo?.trim() || null,
      buildingAccessCode: building.accessCode?.trim() || null,
      conciergeAccessCode: building.concierge?.accessCode?.trim() || null,
      conciergeUrl: building.concierge?.url?.trim() || null,
      contactEmail: building.email?.trim() || null,
      contactPhone: building.phone?.trim() || null,
    };
  }
}
