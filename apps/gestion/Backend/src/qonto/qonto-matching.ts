import { extractReservationReference } from "@coworkprysme/shared";

export type QontoMatchKind = "exact" | "amount_mismatch" | "no_reservation";

export interface PendingBankTransferInvoice {
  reservationReference: string;
  amountDueCents: number;
  invoiceId: string;
  reservationId: string;
}

export interface QontoMatchInput {
  /** Free-text fields from the Qonto credit (label, reference, …). */
  observedTexts: string[];
  amountCents: number;
  /**
   * Pending bank-transfer invoice for the extracted reservation ref, or null
   * when none is eligible. Caller resolves this from DB before matching.
   */
  pending: PendingBankTransferInvoice | null;
}

export interface QontoMatchResult {
  kind: QontoMatchKind;
  reservationReference: string | null;
  amountDueCents?: number;
  invoiceId?: string;
  reservationId?: string;
  observedLabel: string;
}

/**
 * Pure matching: extract RES-… from Qonto text, compare amount to balance due.
 * Never confirms payment — callers only persist a suggestion.
 */
export function matchQontoCredit(input: QontoMatchInput): QontoMatchResult {
  const observedLabel = input.observedTexts
    .map((t) => t?.trim())
    .filter((t): t is string => Boolean(t))
    .join(" | ");

  let reservationReference: string | null = null;
  for (const text of input.observedTexts) {
    const found = extractReservationReference(text ?? "");
    if (found) {
      reservationReference = found;
      break;
    }
  }

  if (!reservationReference) {
    return { kind: "no_reservation", reservationReference: null, observedLabel };
  }

  if (!input.pending || input.pending.reservationReference !== reservationReference) {
    return {
      kind: "no_reservation",
      reservationReference,
      observedLabel,
    };
  }

  const pending = input.pending;

  if (input.amountCents === pending.amountDueCents) {
    return {
      kind: "exact",
      reservationReference,
      amountDueCents: pending.amountDueCents,
      invoiceId: pending.invoiceId,
      reservationId: pending.reservationId,
      observedLabel,
    };
  }

  return {
    kind: "amount_mismatch",
    reservationReference,
    amountDueCents: pending.amountDueCents,
    invoiceId: pending.invoiceId,
    reservationId: pending.reservationId,
    observedLabel,
  };
}
