import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  connectMongo,
  expireAwaitingPaymentReservations,
  findDueBankTransferReminders,
  getClientAccountModel,
  markBankTransferReminderSent,
} from "@coworkprysme/db";
import type Stripe from "stripe";

import { loadBankTransferRibConfig } from "../booking/bank-transfer.config.js";
/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime class reference */
import { BookingEmailsService } from "../booking/booking-emails.service.js";
import { BookingPaymentService } from "./booking-payment.service.js";

/** How often we sweep expired awaiting_payment holds and bank-transfer reminders. */
export const AWAITING_PAYMENT_EXPIRY_INTERVAL_MS = 60_000;

export interface CancelStripePaymentIntentResult {
  paymentIntentId: string;
  cancelled: boolean;
  /** Stripe status after the attempt (or before if already terminal). */
  status: string;
  reason?: string;
}

/**
 * Periodically:
 * - expires unpaid awaiting_payment holds (card + bank_transfer)
 * - cancels Stripe PaymentIntents for card holds
 * - sends bank_transfer reminder ladder (J+2 / J+4 / J+6) and expiry emails
 */
@Injectable()
export class AwaitingPaymentExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AwaitingPaymentExpiryService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly bookingPayment: BookingPaymentService,
    private readonly bookingEmails: BookingEmailsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.sweep().catch((error: unknown) => {
        this.logger.error(
          `Awaiting payment expiry sweep failed: ${error instanceof Error ? error.message : error}`,
        );
      });
    }, AWAITING_PAYMENT_EXPIRY_INTERVAL_MS);
    // Unref so the interval does not keep the Nest process alive in tests/shutdown.
    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async sweep(now: Date = new Date()): Promise<{
    expiredCount: number;
    remindersSent: number;
    paymentIntentsCancelled: CancelStripePaymentIntentResult[];
  }> {
    const remindersSent = await this.sendDueBankTransferReminders(now);

    const { expired } = await expireAwaitingPaymentReservations(now);
    const paymentIntentsCancelled: CancelStripePaymentIntentResult[] = [];

    for (const row of expired) {
      this.logger.log(
        `Expired awaiting_payment reservation ${row.reference} id=${row.reservationId} method=${row.awaitingPaymentMethod ?? "unknown"}`,
      );

      if (row.awaitingPaymentMethod === "bank_transfer") {
        await this.sendBankTransferExpiredIfPossible(row);
      }

      if (!row.stripePaymentIntentId) {
        continue;
      }
      const cancelResult = await this.cancelStripePaymentIntent(row.stripePaymentIntentId);
      paymentIntentsCancelled.push(cancelResult);
    }

    return { expiredCount: expired.length, remindersSent, paymentIntentsCancelled };
  }

  /**
   * Sends due J+2/J+4/J+6 reminders. markBankTransferReminderSent only succeeds while
   * status remains awaiting_payment — mark-received stops the ladder immediately.
   */
  async sendDueBankTransferReminders(now: Date = new Date()): Promise<number> {
    const rib = loadBankTransferRibConfig();
    if (!rib) {
      return 0;
    }

    const due = await findDueBankTransferReminders(now);
    let sent = 0;

    for (const candidate of due) {
      const marked = await markBankTransferReminderSent(candidate.reservationId, candidate.tier);
      if (!marked) {
        // Already confirmed/cancelled/paid — do not email.
        continue;
      }

      const clientEmail = await this.resolveClientEmail(candidate.clientAccountId);
      if (!clientEmail) {
        this.logger.warn(
          `Bank transfer reminder ${candidate.tier} skipped for ${candidate.reference}: no client email`,
        );
        continue;
      }

      try {
        const building = await this.bookingEmails.resolveBuildingAccess(candidate.buildingId);
        await this.bookingEmails.sendBankTransferReminderEmail({
          clientEmail,
          reservationReference: candidate.reference,
          invoiceReference: candidate.invoiceReference,
          spaceName: candidate.spaceName,
          startAt: candidate.startAt,
          endAt: candidate.endAt,
          amountCents: candidate.amountCents,
          expiresAt: candidate.expiresAt,
          rib,
          transferLabel: candidate.reference,
          tier: candidate.tier,
          building,
        });
        sent += 1;
        this.logger.log(`Sent bank_transfer reminder ${candidate.tier} for ${candidate.reference}`);
      } catch (error) {
        this.logger.error(
          `Failed bank_transfer reminder ${candidate.tier} for ${candidate.reference}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return sent;
  }

  private async sendBankTransferExpiredIfPossible(row: {
    reference: string;
    clientAccountId?: string;
    spaceName?: string;
  }) {
    if (!row.clientAccountId) {
      return;
    }
    const clientEmail = await this.resolveClientEmail(row.clientAccountId);
    if (!clientEmail) {
      return;
    }
    try {
      await this.bookingEmails.sendBankTransferExpiredEmail({
        clientEmail,
        reservationReference: row.reference,
        spaceName: row.spaceName ?? "Espace",
      });
    } catch (error) {
      this.logger.error(
        `Failed bank_transfer expiry email for ${row.reference}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async resolveClientEmail(clientAccountId: string): Promise<string | null> {
    await connectMongo();
    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findById(clientAccountId)
      .select({ email: 1 })
      .lean()
      .exec();
    return account?.email?.trim().toLowerCase() || null;
  }

  /**
   * Cancels an open Stripe PaymentIntent after a local reservation expiry.
   * No-ops safely when the PI is already cancelled/succeeded/terminal.
   */
  async cancelStripePaymentIntent(
    paymentIntentId: string,
  ): Promise<CancelStripePaymentIntentResult> {
    let stripe: Stripe;
    try {
      stripe = this.bookingPayment.getStripe();
    } catch (error) {
      this.logger.warn(
        `Cannot cancel PaymentIntent ${paymentIntentId}: Stripe not configured (${error instanceof Error ? error.message : error})`,
      );
      return {
        paymentIntentId,
        cancelled: false,
        status: "unknown",
        reason: "stripe_not_configured",
      };
    }

    try {
      const existing = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (existing.status === "canceled") {
        return {
          paymentIntentId,
          cancelled: false,
          status: existing.status,
          reason: "already_canceled",
        };
      }
      if (existing.status === "succeeded") {
        this.logger.warn(
          `PaymentIntent ${paymentIntentId} already succeeded while reservation expired — leaving PI as-is`,
        );
        return {
          paymentIntentId,
          cancelled: false,
          status: existing.status,
          reason: "already_succeeded",
        };
      }

      const cancelable = new Set([
        "requires_payment_method",
        "requires_capture",
        "requires_confirmation",
        "requires_action",
        "processing",
      ]);
      if (!cancelable.has(existing.status)) {
        return {
          paymentIntentId,
          cancelled: false,
          status: existing.status,
          reason: "not_cancelable",
        };
      }

      const cancelled = await stripe.paymentIntents.cancel(paymentIntentId);
      this.logger.log(
        `Cancelled Stripe PaymentIntent ${paymentIntentId} status=${cancelled.status}`,
      );
      return { paymentIntentId, cancelled: true, status: cancelled.status };
    } catch (error) {
      this.logger.error(
        `Failed to cancel PaymentIntent ${paymentIntentId}: ${error instanceof Error ? error.message : error}`,
      );
      return {
        paymentIntentId,
        cancelled: false,
        status: "error",
        reason: error instanceof Error ? error.message : "unknown_error",
      };
    }
  }
}
