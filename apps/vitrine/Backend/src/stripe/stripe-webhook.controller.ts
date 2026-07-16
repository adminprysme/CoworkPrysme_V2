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
import { BookingPaymentService } from "./booking-payment.service.js";

@Controller("stripe")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly bookingPayment: BookingPaymentService) {}

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
      event = this.bookingPayment
        .getStripe()
        .webhooks.constructEvent(rawBody, signature, this.bookingPayment.getWebhookSecret());
    } catch (error) {
      this.logger.warn(`Stripe webhook signature verification failed: ${String(error)}`);
      throw new BadRequestException("Invalid Stripe signature");
    }

    await this.bookingPayment.handleWebhookEvent(event);
    return { received: true };
  }
}
