import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  connectMongo,
  getInvoiceModel,
  getPaymentModel,
  getQontoTransferCandidateModel,
  getReservationModel,
  type QontoCandidateMatchStatus,
} from "@coworkprysme/db";
import { extractReservationReference } from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI */
import { QontoApiClient, type QontoTransactionDto } from "./qonto-api.client.js";
import { QontoAuthService } from "./qonto-auth.service.js";
import { QontoConfigService } from "./qonto-config.service.js";
import { matchQontoCredit, type PendingBankTransferInvoice } from "./qonto-matching.js";

/** Look-back window when polling credits. */
export const QONTO_SYNC_LOOKBACK_DAYS = 14;

@Injectable()
export class QontoSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QontoSyncService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly pendingCache = new Map<string, PendingBankTransferInvoice | null>();

  constructor(
    private readonly qontoConfig: QontoConfigService,
    private readonly auth: QontoAuthService,
    private readonly api: QontoApiClient,
  ) {}

  onModuleInit() {
    if (!this.qontoConfig.isEnabled()) {
      this.logger.log("Qonto sync disabled (env not configured)");
      return;
    }

    const interval = this.qontoConfig.config.pollIntervalMs;
    this.timer = setInterval(() => {
      void this.syncRecentCredits().catch((error: unknown) => {
        this.logger.error(
          `Qonto sync failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, interval);
    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }
    this.logger.log(`Qonto credit poller started intervalMs=${interval}`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async syncRecentCredits(now: Date = new Date()): Promise<{
    fetched: number;
    upserted: number;
    skipped: number;
  }> {
    if (!this.qontoConfig.isEnabled()) {
      return { fetched: 0, upserted: 0, skipped: 0 };
    }
    const authorized = await this.auth.hasStoredCredentials();
    if (!authorized) {
      this.logger.debug("Qonto sync skipped — OAuth not completed");
      return { fetched: 0, upserted: 0, skipped: 0 };
    }

    this.pendingCache.clear();

    const settledAtFrom = new Date(now);
    settledAtFrom.setUTCDate(settledAtFrom.getUTCDate() - QONTO_SYNC_LOOKBACK_DAYS);

    const transactions = await this.api.listCreditTransactions({ settledAtFrom, settledAtTo: now });
    let upserted = 0;
    let skipped = 0;

    for (const tx of transactions) {
      const result = await this.upsertCandidateFromTransaction(tx);
      if (result === "upserted") {
        upserted += 1;
      } else {
        skipped += 1;
      }
    }

    this.logger.log(
      `Qonto sync done fetched=${transactions.length} upserted=${upserted} skipped=${skipped}`,
    );
    return { fetched: transactions.length, upserted, skipped };
  }

  private async upsertCandidateFromTransaction(
    tx: QontoTransactionDto,
  ): Promise<"upserted" | "skipped"> {
    if (!tx.transaction_id || !Number.isInteger(tx.amount_cents) || tx.amount_cents <= 0) {
      return "skipped";
    }
    if (tx.side && tx.side !== "credit") {
      return "skipped";
    }

    await connectMongo();
    const Payment = await getPaymentModel();
    const alreadyPaid = await Payment.exists({
      "reconciliation.qontoTxId": tx.transaction_id,
    }).exec();
    if (alreadyPaid) {
      return "skipped";
    }

    const Candidate = await getQontoTransferCandidateModel();
    const existing = await Candidate.findOne({ qontoTxId: tx.transaction_id }).exec();
    if (existing?.consumedAt) {
      return "skipped";
    }

    const observedTexts = [tx.label ?? "", tx.reference ?? ""];
    let extractedRef: string | null = null;
    for (const text of observedTexts) {
      extractedRef = extractReservationReference(text);
      if (extractedRef) {
        break;
      }
    }

    const pending = extractedRef ? await this.resolvePending(extractedRef) : null;
    const match = matchQontoCredit({
      observedTexts,
      amountCents: tx.amount_cents,
      pending,
    });

    const matchStatus: QontoCandidateMatchStatus =
      match.kind === "exact"
        ? "exact"
        : match.kind === "amount_mismatch"
          ? "amount_mismatch"
          : "no_reservation";

    const settledAt = tx.settled_at ? new Date(tx.settled_at) : null;
    const setFields: Record<string, unknown> = {
      amountCents: tx.amount_cents,
      currency: tx.currency || "EUR",
      settledAt,
      observedLabel: match.observedLabel,
      reservationReference: match.reservationReference,
      matchStatus,
    };

    if (match.invoiceId && match.reservationId && typeof match.amountDueCents === "number") {
      setFields.invoiceId = match.invoiceId;
      setFields.reservationId = match.reservationId;
      setFields.amountDueCents = match.amountDueCents;
    }

    const update: Record<string, unknown> = {
      $set: setFields,
      $setOnInsert: { qontoTxId: tx.transaction_id },
    };
    if (!match.invoiceId) {
      update.$unset = { invoiceId: 1, reservationId: 1, amountDueCents: 1 };
    }

    await Candidate.findOneAndUpdate({ qontoTxId: tx.transaction_id }, update, {
      upsert: true,
    }).exec();

    return "upserted";
  }

  private async resolvePending(
    reservationReference: string,
  ): Promise<PendingBankTransferInvoice | null> {
    if (this.pendingCache.has(reservationReference)) {
      return this.pendingCache.get(reservationReference) ?? null;
    }

    await connectMongo();
    const Reservation = await getReservationModel();
    const Invoice = await getInvoiceModel();
    const reservation = await Reservation.findOne({ reference: reservationReference }).exec();
    if (
      !reservation ||
      reservation.status !== "awaiting_payment" ||
      reservation.awaitingPaymentMethod !== "bank_transfer"
    ) {
      this.pendingCache.set(reservationReference, null);
      return null;
    }

    const invoice = await Invoice.findOne({ reservationId: reservation._id }).exec();
    if (!invoice || invoice.totals.balanceDue <= 0) {
      this.pendingCache.set(reservationReference, null);
      return null;
    }

    const value: PendingBankTransferInvoice = {
      reservationReference,
      amountDueCents: invoice.totals.balanceDue,
      invoiceId: invoice._id.toString(),
      reservationId: reservation._id.toString(),
    };
    this.pendingCache.set(reservationReference, value);
    return value;
  }
}
