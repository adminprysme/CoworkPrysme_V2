import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type Stripe from "stripe";

import { createStripeClient, loadStripeRefundConfig } from "./stripe.config.js";

export interface CreateCardRefundInput {
  paymentIntentId: string;
  amountCents: number;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface CreateCardRefundResult {
  stripeRefundId: string;
  status: string;
  amountCents: number;
  paymentIntentId: string;
}

@Injectable()
export class StripeRefundService {
  private readonly logger = new Logger(StripeRefundService.name);
  private client: Stripe | null = null;
  private mode: "test" | "live" | "unknown" = "unknown";
  private webhookSecret: string | null = null;
  private loggedMode = false;

  private ensureClient(): Stripe {
    if (this.client) return this.client;
    const config = loadStripeRefundConfig();
    if (!config) {
      throw new ServiceUnavailableException({
        code: "STRIPE_NOT_CONFIGURED",
        message: "STRIPE_SECRET_KEY manquant (même compte/mode que vitrine-api)",
      });
    }
    this.client = createStripeClient(config.secretKey);
    this.mode = config.mode;
    this.webhookSecret = config.webhookSecret;
    if (!this.loggedMode) {
      this.logger.log(`Stripe refund client mode=${this.mode} (must match vitrine-api PI account)`);
      this.loggedMode = true;
    }
    return this.client;
  }

  getWebhookSecret(): string | null {
    if (this.webhookSecret !== null) return this.webhookSecret;
    const config = loadStripeRefundConfig();
    this.webhookSecret = config?.webhookSecret ?? null;
    return this.webhookSecret;
  }

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.getWebhookSecret();
    if (!secret) {
      throw new ServiceUnavailableException({
        code: "STRIPE_WEBHOOK_NOT_CONFIGURED",
        message: "STRIPE_WEBHOOK_SECRET manquant",
      });
    }
    const stripe = this.ensureClient();
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  async createCardRefund(input: CreateCardRefundInput): Promise<CreateCardRefundResult> {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new Error("amountCents must be a positive integer");
    }
    const paymentIntentId = input.paymentIntentId.trim();
    const idempotencyKey = input.idempotencyKey.trim();
    if (!paymentIntentId || !idempotencyKey) {
      throw new Error("paymentIntentId and idempotencyKey are required");
    }

    const stripe = this.ensureClient();
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: input.amountCents,
        reason: "requested_by_customer",
        metadata: input.metadata,
      },
      { idempotencyKey },
    );

    const pi =
      typeof refund.payment_intent === "string"
        ? refund.payment_intent
        : (refund.payment_intent?.id ?? paymentIntentId);

    return {
      stripeRefundId: refund.id,
      status: refund.status ?? "pending",
      amountCents: refund.amount,
      paymentIntentId: pi,
    };
  }
}
