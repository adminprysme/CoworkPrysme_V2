import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import {
  CreateQuotePaymentIntentRequestSchema,
  CreateQuotePaymentIntentResponseSchema,
  QuotePaymentLinkPreviewQuerySchema,
  QuotePaymentLinkPreviewSchema,
  QuotePaymentStatusQuerySchema,
  QuotePaymentStatusResponseSchema,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { QuotePaymentService } from "./quote-payment.service.js";

/**
 * Devis payment-link API (Option B).
 * Preview amount via redeem token, then create PaymentIntent for Stripe Elements.
 * Not Stripe native Payment Links.
 */
@Controller("quotes/payments")
export class QuotePaymentController {
  constructor(private readonly quotePayment: QuotePaymentService) {}

  @Get("preview")
  async preview(@Query() query: Record<string, unknown>) {
    const parsed = QuotePaymentLinkPreviewQuerySchema.parse(query);
    const payload = await this.quotePayment.preview(parsed);
    return QuotePaymentLinkPreviewSchema.parse(payload);
  }

  @Post("intent")
  async createIntent(@Body() body: Record<string, unknown>) {
    const parsed = CreateQuotePaymentIntentRequestSchema.parse(body);
    const payload = await this.quotePayment.createPaymentIntent(parsed);
    return CreateQuotePaymentIntentResponseSchema.parse(payload);
  }

  @Get("status")
  async getStatus(@Query() query: Record<string, unknown>) {
    const parsed = QuotePaymentStatusQuerySchema.parse(query);
    const payload = await this.quotePayment.getStatus(parsed);
    return QuotePaymentStatusResponseSchema.parse(payload);
  }
}
