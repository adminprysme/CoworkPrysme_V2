import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import {
  BOOKING_PAYMENT_ACCESS_TOKEN_TTL_MS,
  BOOKING_PAYMENT_ERROR_CODES,
  signBookingPaymentAccessToken,
  verifyBookingPaymentAccessToken,
} from "@coworkprysme/shared/server";

function loadPaymentTokenSecret(): string {
  const secret = process.env.BOOKING_PAYMENT_TOKEN_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new ServiceUnavailableException({
      code: BOOKING_PAYMENT_ERROR_CODES.STRIPE_NOT_CONFIGURED,
      message: "Paiement indisponible (configuration serveur incomplète)",
    });
  }
  return secret;
}

/**
 * Token lifetime: min(invoice payment TTL 24h, hold awaitingPaymentExpiresAt).
 */
export function issueBookingPaymentAccessToken(input: {
  reservationReference: string;
  invoiceReference: string;
  awaitingPaymentExpiresAt?: Date | null;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const ttlCap = new Date(now.getTime() + BOOKING_PAYMENT_ACCESS_TOKEN_TTL_MS);
  const holdCap = input.awaitingPaymentExpiresAt
    ? new Date(input.awaitingPaymentExpiresAt)
    : ttlCap;
  const expiresAt = holdCap.getTime() < ttlCap.getTime() ? holdCap : ttlCap;

  return signBookingPaymentAccessToken({
    reservationReference: input.reservationReference,
    invoiceReference: input.invoiceReference,
    expiresAt,
    secret: loadPaymentTokenSecret(),
  });
}

/** Throws a uniform UnauthorizedException when the token is missing or invalid. */
export function assertBookingPaymentAccessToken(input: {
  token: string;
  reservationReference: string;
  invoiceReference: string;
  now?: Date;
}): void {
  const result = verifyBookingPaymentAccessToken({
    token: input.token,
    reservationReference: input.reservationReference,
    invoiceReference: input.invoiceReference,
    secret: loadPaymentTokenSecret(),
    now: input.now,
  });
  if (!result.ok) {
    throw new UnauthorizedException({
      code: BOOKING_PAYMENT_ERROR_CODES.PAYMENT_TOKEN_INVALID,
      message: "Jeton d'accès paiement invalide ou expiré",
    });
  }
}
