/**
 * Stripe redirect return for booking card payment.
 * Webhook remains the source of truth — this URL only resumes the UI and polls status.
 */

export const BOOKING_PAYMENT_RETURN_PARAM = "payment_return";
export const BOOKING_PAYMENT_RESUME_STORAGE_KEY = "vitrine-booking-payment-resume-v1";

export type BookingPaymentResumeSnapshot = {
  version: 1;
  reservationReference: string;
  invoiceReference: string;
  reservationStatus:
    "awaiting_payment" | "confirmed" | "cancelled" | "pending" | "completed" | "no_show";
  spaceLabel: string;
  slotLabel: string;
};

export type BookingStripeReturnParams = {
  reservationReference: string;
  invoiceReference: string;
  /** Stripe-appended; never used as payment truth. */
  redirectStatus: string | null;
  paymentIntentId: string | null;
};

/** Absolute return_url for stripe.confirmPayment (must never be empty/undefined). */
export function buildBookingPaymentReturnUrl(input: {
  origin: string;
  reservationReference: string;
  invoiceReference: string;
}): string {
  const url = new URL(
    "/reservation",
    input.origin.endsWith("/") ? input.origin : `${input.origin}/`,
  );
  url.searchParams.set(BOOKING_PAYMENT_RETURN_PARAM, "1");
  url.searchParams.set("reservationReference", input.reservationReference.trim());
  url.searchParams.set("invoiceReference", input.invoiceReference.trim());
  return url.toString();
}

export function parseBookingStripeReturnParams(
  search: string | URLSearchParams,
): BookingStripeReturnParams | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const isReturn = params.get(BOOKING_PAYMENT_RETURN_PARAM) === "1";
  const reservationReference = params.get("reservationReference")?.trim() ?? "";
  const invoiceReference = params.get("invoiceReference")?.trim() ?? "";

  // Stripe may land with only payment_intent_* if return_url was bare; require our refs.
  if (!isReturn || !reservationReference || !invoiceReference) {
    return null;
  }

  return {
    reservationReference,
    invoiceReference,
    redirectStatus: params.get("redirect_status"),
    paymentIntentId: params.get("payment_intent"),
  };
}

export function saveBookingPaymentResumeSnapshot(snapshot: BookingPaymentResumeSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(BOOKING_PAYMENT_RESUME_STORAGE_KEY, JSON.stringify(snapshot));
}

export function loadBookingPaymentResumeSnapshot(
  reservationReference: string,
): BookingPaymentResumeSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(BOOKING_PAYMENT_RESUME_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as BookingPaymentResumeSnapshot;
    if (parsed.version !== 1 || parsed.reservationReference !== reservationReference) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearBookingPaymentResumeSnapshot(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(BOOKING_PAYMENT_RESUME_STORAGE_KEY);
}

/** Strip Stripe return query keys after we have read them (keep path clean). */
export function stripBookingStripeReturnQuery(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(BOOKING_PAYMENT_RETURN_PARAM);
  url.searchParams.delete("reservationReference");
  url.searchParams.delete("invoiceReference");
  url.searchParams.delete("payment_intent");
  url.searchParams.delete("payment_intent_client_secret");
  url.searchParams.delete("redirect_status");
  return `${url.pathname}${url.search}${url.hash}`;
}
