import {
  BookingPriceRequestSchema,
  BookingPriceResponseSchema,
  BookingServicesResponseSchema,
  type BookingPriceRequest,
  type BookingPriceResponse,
  type BookingServicesQuery,
} from "@coworkprysme/shared";

import { bookingFetch, buildQuery } from "./booking-api-client.js";

export async function fetchBookingServices(query: BookingServicesQuery) {
  const qs = buildQuery({ buildingId: query.buildingId });
  const data = await bookingFetch(`/booking/services?${qs}`, BookingServicesResponseSchema);
  return data.services;
}

export async function fetchBookingPrice(input: BookingPriceRequest): Promise<BookingPriceResponse> {
  BookingPriceRequestSchema.parse(input);
  return bookingFetch("/booking/price", BookingPriceResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
