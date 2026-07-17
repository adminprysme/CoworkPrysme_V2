import { describe, expect, it } from "vitest";

import {
  signBookingPaymentAccessToken,
  verifyBookingPaymentAccessToken,
} from "./booking-payment-token.js";

const SECRET = "test-booking-payment-token-secret-32chars!!";

describe("booking payment access token", () => {
  it("round-trips a valid token bound to reservation + invoice", () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const token = signBookingPaymentAccessToken({
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
      expiresAt,
      secret: SECRET,
    });

    const verified = verifyBookingPaymentAccessToken({
      token,
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
      secret: SECRET,
    });
    expect(verified.ok).toBe(true);
  });

  it("rejects missing, malformed, wrong-signature, mismatched refs, and expired tokens", () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const token = signBookingPaymentAccessToken({
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
      expiresAt,
      secret: SECRET,
    });

    expect(
      verifyBookingPaymentAccessToken({
        token: "not-a-token",
        reservationReference: "RES-2026-00042",
        invoiceReference: "PF-2026-00042",
        secret: SECRET,
      }).ok,
    ).toBe(false);

    expect(
      verifyBookingPaymentAccessToken({
        token: `${token.slice(0, -4)}xxxx`,
        reservationReference: "RES-2026-00042",
        invoiceReference: "PF-2026-00042",
        secret: SECRET,
      }).ok,
    ).toBe(false);

    expect(
      verifyBookingPaymentAccessToken({
        token,
        reservationReference: "RES-2026-99999",
        invoiceReference: "PF-2026-00042",
        secret: SECRET,
      }).ok,
    ).toBe(false);

    const expired = signBookingPaymentAccessToken({
      reservationReference: "RES-2026-00042",
      invoiceReference: "PF-2026-00042",
      expiresAt: new Date(Date.now() - 1_000),
      secret: SECRET,
    });
    expect(
      verifyBookingPaymentAccessToken({
        token: expired,
        reservationReference: "RES-2026-00042",
        invoiceReference: "PF-2026-00042",
        secret: SECRET,
      }).ok,
    ).toBe(false);
  });
});
