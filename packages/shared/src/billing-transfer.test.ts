import { describe, expect, it } from "vitest";

import {
  BankTransferPendingLookupResponseSchema,
  extractReservationReference,
  MarkBankTransferReceivedRequestSchema,
  QontoTransferSuggestionSchema,
} from "./billing-transfer.js";

describe("extractReservationReference", () => {
  it("extracts RES-YYYY-NNNNN from a Qonto label", () => {
    expect(extractReservationReference("Virement RES-2026-00042 reçu")).toBe("RES-2026-00042");
  });

  it("returns null when no reservation reference is present", () => {
    expect(extractReservationReference("Paiement fournisseur facture 123")).toBeNull();
  });
});

describe("QontoTransferSuggestionSchema", () => {
  it("accepts an exact match suggestion", () => {
    const parsed = QontoTransferSuggestionSchema.parse({
      matchStatus: "exact",
      qontoTxId: "tx-abc",
      amountCents: 12_000,
      currency: "EUR",
      settledAt: "2026-07-16T10:00:00.000Z",
      observedLabel: "RES-2026-00042",
      reservationReference: "RES-2026-00042",
      amountDueCents: 12_000,
    });
    expect(parsed.matchStatus).toBe("exact");
  });
});

describe("MarkBankTransferReceivedRequestSchema", () => {
  it("accepts optional qontoTxId", () => {
    const parsed = MarkBankTransferReceivedRequestSchema.parse({
      reference: "RES-2026-00042",
      qontoTxId: "tx-abc",
    });
    expect(parsed.qontoTxId).toBe("tx-abc");
  });
});

describe("BankTransferPendingLookupResponseSchema", () => {
  it("accepts optional qontoSuggestion", () => {
    const parsed = BankTransferPendingLookupResponseSchema.parse({
      found: true,
      reservationReference: "RES-2026-00042",
      amountDueCents: 12_000,
      awaitingPaymentMethod: "bank_transfer",
      reservationStatus: "awaiting_payment",
      qontoSuggestion: {
        matchStatus: "amount_mismatch",
        qontoTxId: "tx-abc",
        amountCents: 11_000,
        currency: "EUR",
        reservationReference: "RES-2026-00042",
        amountDueCents: 12_000,
        observedLabel: "RES-2026-00042",
      },
    });
    expect(parsed.qontoSuggestion?.matchStatus).toBe("amount_mismatch");
  });
});
