import type { Types } from "mongoose";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { InvoiceDocument } from "@coworkprysme/db";
import type { ReservationDocument } from "@coworkprysme/db";
import {
  applyBankTransferPayment,
  confirmReservationAfterPayment,
  connectMongo,
  getAuditLogModel,
  getBuildingModel,
  getCardexModel,
  getClientAccountModel,
  getInvoiceModel,
  getPaymentModel,
  getQontoTransferCandidateModel,
  getReservationModel,
} from "@coworkprysme/db";
import type {
  BankTransferPendingListItem,
  BankTransferPendingLookupResponse,
  BankTransferTransfersResponse,
  BankTransferValidatedListItem,
  MarkBankTransferReceivedResponse,
  QontoTransferSuggestion,
} from "@coworkprysme/shared";
import {
  BANK_TRANSFER_VALIDATED_DAYS_DEFAULT,
  renderPaymentConfirmedEmail,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { InvoicePdfService } from "@coworkprysme/invoice-pdf";
import {
  MailService,
  emailDeliveryAuditDiff,
  mailDeliveryFromResult,
} from "../mail/mail.service.js";

interface TransferPair {
  reservation: ReservationDocument;
  invoice: InvoiceDocument;
  clientEmail: string | null;
}

interface CardexLabel {
  clientLabel: string;
  companyName: string | null;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly mail: MailService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  /**
   * Lists pending bank-transfer holds + recently validated transfer payments.
   *
   * Validated origin: `awaitingPaymentMethod` is $unset on confirm
   * (`confirmReservationAfterPayment`), so we derive "was bank transfer" from
   * `Payment.method === "transfer"` (durable), and Qonto vs manual from
   * `Payment.reconciliation.qontoTxId` presence only.
   */
  async listTransfers(
    validatedDays: number = BANK_TRANSFER_VALIDATED_DAYS_DEFAULT,
  ): Promise<BankTransferTransfersResponse> {
    await connectMongo();
    const [pending, validated] = await Promise.all([
      this.listPendingTransfers(),
      this.listValidatedTransfers(validatedDays),
    ]);
    return { pending, validated, validatedDays };
  }

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
        reservationId: pair.reservation._id,
        spaceId: String(pair.reservation.spaceId),
        staffProfileId: staffProfileId?.trim() || undefined,
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

  private async listPendingTransfers(): Promise<BankTransferPendingListItem[]> {
    const Reservation = await getReservationModel();
    const Invoice = await getInvoiceModel();

    const reservations = await Reservation.find({
      status: "awaiting_payment",
      awaitingPaymentMethod: "bank_transfer",
    })
      .sort({ awaitingPaymentExpiresAt: 1, createdAt: 1 })
      .exec();

    if (reservations.length === 0) {
      return [];
    }

    const reservationIds = reservations.map((row) => row._id);
    const invoices = await Invoice.find({
      reservationId: { $in: reservationIds },
      "totals.balanceDue": { $gt: 0 },
    }).exec();
    const invoiceByReservationId = new Map(
      invoices.map((invoice) => [String(invoice.reservationId), invoice]),
    );

    const cardexIds = [
      ...new Set(
        reservations
          .map((row) => row.cardexId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const labelsByCardexId = await this.resolveCardexLabels(cardexIds);
    const refs = reservations.map((row) => row.reference);
    const suggestionsByRef = await this.findQontoSuggestionsForReferences(refs);

    const rows: BankTransferPendingListItem[] = [];
    for (const reservation of reservations) {
      const invoice = invoiceByReservationId.get(String(reservation._id));
      if (!invoice) {
        continue;
      }
      const labels = reservation.cardexId
        ? (labelsByCardexId.get(String(reservation.cardexId)) ?? {
            clientLabel: "—",
            companyName: null,
          })
        : { clientLabel: "—", companyName: null };
      const qontoSuggestion = suggestionsByRef.get(reservation.reference);
      rows.push({
        reservationId: reservation._id.toString(),
        reservationReference: reservation.reference,
        invoiceId: invoice._id.toString(),
        invoiceReference: invoice.reference,
        clientLabel: labels.clientLabel,
        companyName: labels.companyName,
        spaceName: reservation.spaceSnapshot.name,
        startAt: new Date(reservation.startAt).toISOString(),
        endAt: new Date(reservation.endAt).toISOString(),
        balanceDueCents: invoice.totals.balanceDue,
        awaitingPaymentExpiresAt: reservation.awaitingPaymentExpiresAt
          ? new Date(reservation.awaitingPaymentExpiresAt).toISOString()
          : null,
        ...(qontoSuggestion ? { qontoSuggestion } : {}),
      });
    }
    return rows;
  }

  private async listValidatedTransfers(
    validatedDays: number,
  ): Promise<BankTransferValidatedListItem[]> {
    const Payment = await getPaymentModel();
    const Invoice = await getInvoiceModel();
    const Reservation = await getReservationModel();

    const since = new Date(Date.now() - validatedDays * 24 * 60 * 60 * 1000);
    const payments = await Payment.find({
      method: "transfer",
      kind: { $ne: "refund" },
      receivedAt: { $gte: since },
    })
      .sort({ receivedAt: -1 })
      .exec();

    if (payments.length === 0) {
      return [];
    }

    const invoiceIds = [...new Set(payments.map((payment) => String(payment.invoiceId)))];
    const invoices = await Invoice.find({ _id: { $in: invoiceIds } }).exec();
    const invoiceById = new Map(invoices.map((invoice) => [String(invoice._id), invoice]));

    const reservationIds = [
      ...new Set(
        invoices
          .map((invoice) => invoice.reservationId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const reservations = await Reservation.find({ _id: { $in: reservationIds } }).exec();
    const reservationById = new Map(
      reservations.map((reservation) => [String(reservation._id), reservation]),
    );

    const cardexIds = [
      ...new Set(
        [
          ...payments.map((payment) => payment.cardexId?.toString()),
          ...reservations.map((reservation) => reservation.cardexId?.toString()),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
    const labelsByCardexId = await this.resolveCardexLabels(cardexIds);

    const rows: BankTransferValidatedListItem[] = [];
    for (const payment of payments) {
      const invoice = invoiceById.get(String(payment.invoiceId));
      if (!invoice?.reservationId) {
        continue;
      }
      const reservation = reservationById.get(String(invoice.reservationId));
      if (!reservation) {
        continue;
      }
      const cardexId = (payment.cardexId ?? reservation.cardexId)?.toString();
      const labels = cardexId
        ? (labelsByCardexId.get(cardexId) ?? { clientLabel: "—", companyName: null })
        : { clientLabel: "—", companyName: null };
      const qontoTxId = payment.reconciliation?.qontoTxId?.trim() || null;
      rows.push({
        reservationId: reservation._id.toString(),
        reservationReference: reservation.reference,
        invoiceId: invoice._id.toString(),
        invoiceReference: invoice.reference,
        paymentId: payment._id.toString(),
        clientLabel: labels.clientLabel,
        companyName: labels.companyName,
        spaceName: reservation.spaceSnapshot.name,
        startAt: new Date(reservation.startAt).toISOString(),
        endAt: new Date(reservation.endAt).toISOString(),
        amountReceivedCents: payment.amount,
        receivedAt: new Date(payment.receivedAt).toISOString(),
        origin: qontoTxId ? "qonto" : "manual",
        qontoTxId,
      });
    }
    return rows;
  }

  private async resolveCardexLabels(cardexIds: string[]): Promise<Map<string, CardexLabel>> {
    const result = new Map<string, CardexLabel>();
    if (cardexIds.length === 0) {
      return result;
    }
    const Cardex = await getCardexModel();
    const rows = await Cardex.find({ _id: { $in: cardexIds } })
      .select({ identity: 1, company: 1 })
      .lean()
      .exec();
    for (const row of rows) {
      const first = row.identity?.firstName?.trim() ?? "";
      const last = row.identity?.lastName?.trim() ?? "";
      const clientLabel = [first, last].filter(Boolean).join(" ") || "—";
      const companyName = row.company?.legalName?.trim() || null;
      result.set(String(row._id), { clientLabel, companyName });
    }
    return result;
  }

  private async findQontoSuggestionsForReferences(
    reservationReferences: string[],
  ): Promise<Map<string, QontoTransferSuggestion>> {
    const result = new Map<string, QontoTransferSuggestion>();
    if (reservationReferences.length === 0) {
      return result;
    }
    await connectMongo();
    const Candidate = await getQontoTransferCandidateModel();
    const candidates = await Candidate.find({
      reservationReference: { $in: reservationReferences },
      consumedAt: { $exists: false },
      matchStatus: { $in: ["exact", "amount_mismatch"] },
    })
      .sort({ settledAt: -1, updatedAt: -1 })
      .lean()
      .exec();

    for (const candidate of candidates) {
      const ref = candidate.reservationReference;
      if (!ref || result.has(ref)) {
        continue;
      }
      result.set(ref, {
        matchStatus: candidate.matchStatus as "exact" | "amount_mismatch",
        qontoTxId: candidate.qontoTxId,
        amountCents: candidate.amountCents,
        currency: candidate.currency || "EUR",
        settledAt: candidate.settledAt ? new Date(candidate.settledAt).toISOString() : null,
        observedLabel: candidate.observedLabel || undefined,
        reservationReference: ref,
        amountDueCents: candidate.amountDueCents ?? 0,
      });
    }
    return result;
  }

  private async findQontoSuggestion(
    reservationReference: string,
  ): Promise<QontoTransferSuggestion | undefined> {
    const map = await this.findQontoSuggestionsForReferences([reservationReference]);
    return map.get(reservationReference);
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
    reservationId: Types.ObjectId;
    spaceId: string;
    staffProfileId?: string;
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

    const mailResult = await this.mail.sendMail({
      to: input.clientEmail,
      subject: email.subject,
      html: email.html,
      attachments,
    });
    const delivery = mailDeliveryFromResult(mailResult);

    const AuditLog = await getAuditLogModel();
    await AuditLog.create({
      actor: input.staffProfileId
        ? { kind: "staff", id: input.staffProfileId }
        : { kind: "system", id: "billing" },
      action: "reservation.payment_confirmed",
      entity: { type: "reservation", id: input.reservationId },
      diff: {
        spaceId: { before: input.spaceId, after: input.spaceId },
        channel: { before: null, after: "bank_transfer" },
        ...emailDeliveryAuditDiff(delivery),
      },
      reason: "bank_transfer_received",
      at: new Date(),
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
