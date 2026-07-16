import { describe, expect, it } from "vitest";

import {
  buildBookingPaymentReturnUrl,
  parseBookingStripeReturnParams,
  stripBookingStripeReturnQuery,
} from "./booking-payment-return";

describe("booking payment return_url", () => {
  it("builds an absolute return_url with reservation refs (never empty)", () => {
    const url = buildBookingPaymentReturnUrl({
      origin: "https://coworkprysme.eu",
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
    });

    expect(url).toBe(
      "https://coworkprysme.eu/reservation?payment_return=1&reservationReference=RES-2026-00042&invoiceReference=PF-2026-00042",
    );
    expect(url).not.toContain("undefined");
  });

  it("parses Stripe return query including redirect_status without treating it as truth", () => {
    const parsed = parseBookingStripeReturnParams(
      "payment_return=1&reservationReference=RES-1&invoiceReference=PF-1&redirect_status=succeeded&payment_intent=pi_abc",
    );
    expect(parsed).toEqual({
      reservationReference: "RES-1",
      invoiceReference: "PF-1",
      redirectStatus: "succeeded",
      paymentIntentId: "pi_abc",
    });
  });

  it("ignores incomplete return URLs (cannot resume without refs)", () => {
    expect(parseBookingStripeReturnParams("redirect_status=succeeded")).toBeNull();
    expect(
      parseBookingStripeReturnParams("payment_return=1&reservationReference=RES-1"),
    ).toBeNull();
  });

  it("strips Stripe return params from the location after resume", () => {
    const cleaned = stripBookingStripeReturnQuery(
      "https://coworkprysme.eu/reservation?payment_return=1&reservationReference=RES-1&invoiceReference=PF-1&payment_intent=pi_x&payment_intent_client_secret=sec&redirect_status=succeeded",
    );
    expect(cleaned).toBe("/reservation");
  });
});
