import { describe, expect, it } from "vitest";

import {
  BANK_TRANSFER_VALIDATED_DAYS_DEFAULT,
  BankTransferPendingLookupResponseSchema,
  BankTransferTransfersQuerySchema,
  BankTransferTransfersResponseSchema,
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

describe("BankTransferTransfersQuerySchema", () => {
  it("defaults validatedDays to 60", () => {
    expect(BankTransferTransfersQuerySchema.parse({}).validatedDays).toBe(
      BANK_TRANSFER_VALIDATED_DAYS_DEFAULT,
    );
  });

  it("coerces string query params", () => {
    expect(BankTransferTransfersQuerySchema.parse({ validatedDays: "90" }).validatedDays).toBe(90);
  });
});

describe("BankTransferTransfersResponseSchema", () => {
  it("accepts pending + validated lists with origin heuristic", () => {
    const parsed = BankTransferTransfersResponseSchema.parse({
      pending: [
        {
          reservationId: "r1",
          reservationReference: "RES-2026-00042",
          invoiceId: "i1",
          invoiceReference: "PF-2026-00042",
          clientLabel: "Alice Martin",
          companyName: "ACME",
          spaceName: "FOCUS",
          startAt: "2026-08-01T08:00:00.000Z",
          endAt: "2026-08-01T17:00:00.000Z",
          balanceDueCents: 12_000,
          awaitingPaymentExpiresAt: "2026-07-30T10:00:00.000Z",
        },
      ],
      validated: [
        {
          reservationId: "r2",
          reservationReference: "RES-2026-00041",
          invoiceId: "i2",
          invoiceReference: "PF-2026-00041",
          paymentId: "p1",
          clientLabel: "Bob",
          spaceName: "OPEN",
          startAt: "2026-07-10T08:00:00.000Z",
          endAt: "2026-07-10T17:00:00.000Z",
          amountReceivedCents: 9_000,
          receivedAt: "2026-07-12T10:00:00.000Z",
          origin: "manual",
          qontoTxId: null,
        },
        {
          reservationId: "r3",
          reservationReference: "RES-2026-00040",
          invoiceId: "i3",
          invoiceReference: "PF-2026-00040",
          paymentId: "p2",
          clientLabel: "Carla",
          spaceName: "FOCUS",
          startAt: "2026-07-01T08:00:00.000Z",
          endAt: "2026-07-01T17:00:00.000Z",
          amountReceivedCents: 15_000,
          receivedAt: "2026-07-02T10:00:00.000Z",
          origin: "qonto",
          qontoTxId: "tx-1",
        },
      ],
      validatedDays: 60,
    });
    expect(parsed.pending).toHaveLength(1);
    expect(parsed.validated.map((row) => row.origin)).toEqual(["manual", "qonto"]);
  });
});
