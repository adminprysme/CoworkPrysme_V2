import {
  BookingCheckEmailResponseSchema,
  BookingConfirmRequestSchema,
  BookingConfirmResponseSchema,
  BookingPaymentMethodsResponseSchema,
  BookingVerifyAccountResponseSchema,
  type BookingConfirmRequest,
  type BookingConfirmResponse,
  type BookingPaymentMethodsResponse,
} from "@coworkprysme/shared";

import { bookingFetch, buildQuery } from "./booking-api-client";

export async function checkBookingEmail(email: string): Promise<boolean> {
  const data = await bookingFetch("/booking/account/check-email", BookingCheckEmailResponseSchema, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return data.exists;
}

export async function verifyBookingAccount(email: string, password: string): Promise<boolean> {
  const data = await bookingFetch("/booking/account/verify", BookingVerifyAccountResponseSchema, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.valid;
}

export async function fetchBookingPaymentMethods(
  startAt: string,
): Promise<BookingPaymentMethodsResponse> {
  const qs = buildQuery({ startAt });
  return bookingFetch(`/booking/payment-methods?${qs}`, BookingPaymentMethodsResponseSchema);
}

export async function confirmBooking(
  input: BookingConfirmRequest,
): Promise<BookingConfirmResponse> {
  BookingConfirmRequestSchema.parse(input);
  return bookingFetch("/booking/confirm", BookingConfirmResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
