import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import {
  BookingPaymentStatusQuerySchema,
  BookingPaymentStatusResponseSchema,
  CreateBookingPaymentIntentRequestSchema,
  CreateBookingPaymentIntentResponseSchema,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { BookingPaymentService } from "./booking-payment.service.js";

/**
 * Payment intent/status require HMAC paymentAccessToken issued at confirm
 * (+ 24h invoice TTL). Sequential references alone are not sufficient.
 * @see ARCHITECTURE.md — Stripe Phase 4a
 */
@Controller("booking/payments")
export class BookingPaymentController {
  constructor(private readonly bookingPayment: BookingPaymentService) {}

  @Post("intent")
  async createIntent(@Body() body: Record<string, unknown>) {
    const parsed = CreateBookingPaymentIntentRequestSchema.parse(body);
    const payload = await this.bookingPayment.createPaymentIntent(parsed);
    return CreateBookingPaymentIntentResponseSchema.parse(payload);
  }

  @Get("status")
  async getStatus(@Query() query: Record<string, unknown>) {
    const parsed = BookingPaymentStatusQuerySchema.parse(query);
    const payload = await this.bookingPayment.getPaymentStatus(parsed);
    return BookingPaymentStatusResponseSchema.parse(payload);
  }
}
