import {
  BookingCheckEmailResponseSchema,
  BookingConfirmRequestSchema,
  BookingConfirmResponseSchema,
  BookingVerifyAccountResponseSchema,
  type BookingConfirmRequest,
  type BookingConfirmResponse,
} from "@coworkprysme/shared";

import { bookingFetch } from "./booking-api-client";

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

export async function confirmBooking(
  input: BookingConfirmRequest,
): Promise<BookingConfirmResponse> {
  BookingConfirmRequestSchema.parse(input);
  return bookingFetch("/booking/confirm", BookingConfirmResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
