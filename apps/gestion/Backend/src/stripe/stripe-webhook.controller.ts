import {
  BadRequestException,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { StripeRefundWebhookService } from "./stripe-refund-webhook.service.js";
import { StripeRefundService } from "./stripe-refund.service.js";

@Controller("stripe")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeRefunds: StripeRefundService,
    private readonly webhookHandler: StripeRefundWebhookService,
  ) {}

  @Post("webhook")
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string | undefined,
  ) {
    if (!signature) {
      throw new BadRequestException("Missing stripe-signature header");
    }

    const rawBody = req.rawBody;
    if (!rawBody || rawBody.length === 0) {
      this.logger.error("Stripe webhook missing raw body — is Nest rawBody enabled?");
      throw new BadRequestException("Missing raw body");
    }

    let event;
    try {
      event = this.stripeRefunds.constructEvent(rawBody, signature);
    } catch (error) {
      this.logger.warn(`Stripe webhook signature verification failed: ${String(error)}`);
      throw new BadRequestException("Invalid Stripe signature");
    }

    await this.webhookHandler.handleEvent(event);
    return { received: true };
  }
}
