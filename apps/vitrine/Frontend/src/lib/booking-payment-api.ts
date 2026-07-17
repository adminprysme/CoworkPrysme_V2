import {
  BookingPaymentStatusResponseSchema,
  CreateBookingPaymentIntentRequestSchema,
  CreateBookingPaymentIntentResponseSchema,
  type BookingPaymentStatusResponse,
  type CreateBookingPaymentIntentRequest,
  type CreateBookingPaymentIntentResponse,
} from "@coworkprysme/shared";

import { bookingFetch } from "./booking-api-client";

export async function createBookingPaymentIntent(
  input: CreateBookingPaymentIntentRequest,
): Promise<CreateBookingPaymentIntentResponse> {
  CreateBookingPaymentIntentRequestSchema.parse(input);
  return bookingFetch("/booking/payments/intent", CreateBookingPaymentIntentResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchBookingPaymentStatus(input: {
  reservationReference: string;
  invoiceReference: string;
  paymentAccessToken: string;
}): Promise<BookingPaymentStatusResponse> {
  const params = new URLSearchParams({
    reservationReference: input.reservationReference,
    invoiceReference: input.invoiceReference,
    paymentAccessToken: input.paymentAccessToken,
  });
  return bookingFetch(`/booking/payments/status?${params}`, BookingPaymentStatusResponseSchema);
}
