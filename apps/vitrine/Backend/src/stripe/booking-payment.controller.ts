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
 * SECURITY DEBT (Phase 4a): these endpoints authenticate via guessable sequential
 * references only (+ 24h invoice TTL). Harden later with a signed per-reservation token.
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
