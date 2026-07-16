import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { expireAwaitingPaymentReservations } from "@coworkprysme/db";
import type Stripe from "stripe";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime class reference */
import { BookingPaymentService } from "./booking-payment.service.js";

/** How often we sweep expired awaiting_payment holds. */
export const AWAITING_PAYMENT_EXPIRY_INTERVAL_MS = 60_000;

export interface CancelStripePaymentIntentResult {
  paymentIntentId: string;
  cancelled: boolean;
  /** Stripe status after the attempt (or before if already terminal). */
  status: string;
  reason?: string;
}

/**
 * Periodically expires unpaid card holds and cancels their Stripe PaymentIntents.
 */
@Injectable()
export class AwaitingPaymentExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AwaitingPaymentExpiryService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly bookingPayment: BookingPaymentService) {}

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
    paymentIntentsCancelled: CancelStripePaymentIntentResult[];
  }> {
    const { expired } = await expireAwaitingPaymentReservations(now);
    const paymentIntentsCancelled: CancelStripePaymentIntentResult[] = [];

    for (const row of expired) {
      this.logger.log(
        `Expired awaiting_payment reservation ${row.reference} id=${row.reservationId}`,
      );
      if (!row.stripePaymentIntentId) {
        continue;
      }
      const cancelResult = await this.cancelStripePaymentIntent(row.stripePaymentIntentId);
      paymentIntentsCancelled.push(cancelResult);
    }

    return { expiredCount: expired.length, paymentIntentsCancelled };
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
