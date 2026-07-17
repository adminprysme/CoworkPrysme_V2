import { createHmac, timingSafeEqual } from "node:crypto";

/** Compact HMAC token binding a reservation+invoice pair until `exp` (unix ms). */
export interface BookingPaymentAccessTokenPayload {
  v: 1;
  res: string;
  inv: string;
  exp: number;
}

export function signBookingPaymentAccessToken(input: {
  reservationReference: string;
  invoiceReference: string;
  expiresAt: Date;
  secret: string;
}): string {
  const payload: BookingPaymentAccessTokenPayload = {
    v: 1,
    res: input.reservationReference.trim(),
    inv: input.invoiceReference.trim(),
    exp: input.expiresAt.getTime(),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", input.secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export type VerifyBookingPaymentAccessTokenResult =
  | { ok: true; payload: BookingPaymentAccessTokenPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "mismatch" | "expired" };

/**
 * Verifies HMAC, binding to the provided references, and expiry.
 * Callers should map any failure to a uniform client error (no reason leakage).
 */
export function verifyBookingPaymentAccessToken(input: {
  token: string;
  reservationReference: string;
  invoiceReference: string;
  secret: string;
  now?: Date;
}): VerifyBookingPaymentAccessTokenResult {
  const parts = input.token.trim().split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "malformed" };
  }
  const [body, sig] = parts;
  const expectedSig = createHmac("sha256", input.secret).update(body).digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: BookingPaymentAccessTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as BookingPaymentAccessTokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    payload.v !== 1 ||
    typeof payload.res !== "string" ||
    typeof payload.inv !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  if (
    payload.res !== input.reservationReference.trim() ||
    payload.inv !== input.invoiceReference.trim()
  ) {
    return { ok: false, reason: "mismatch" };
  }

  const now = input.now ?? new Date();
  if (now.getTime() >= payload.exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}
