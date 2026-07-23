import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import { registerQuoteModel } from "../domains/billing/quote.schema.js";
import { registerInvoiceModel } from "../domains/billing/invoice.schema.js";
import { registerClientAccountModel } from "../domains/client/client-account.schema.js";
import { registerReservationModel } from "../domains/reservation/reservation.schema.js";
import {
  CLIENT_ACCOUNT_STATUSES,
  QUOTE_LINE_PRICE_SOURCES,
  QUOTE_PAYMENT_METHODS,
  QUOTE_STATUSES,
} from "../lib/enums.js";
import { CENTS_VALIDATOR } from "../lib/schema-helpers.js";
import { quoteLineSchema } from "../lib/subdocuments.js";

function minimalQuoteInput(overrides: Record<string, unknown> = {}) {
  return {
    reference: "DEV-2026-00001",
    currency: "EUR",
    lines: [],
    vatBreakdown: [],
    totals: { ht: 0, vat: 0, ttc: 0, discountTotal: 0 },
    depositPercent: 0,
    status: "draft" as const,
    validUntil: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function spaceQuoteLine(overrides: Record<string, unknown> = {}) {
  return {
    lineId: "line-1",
    kind: "space" as const,
    label: "FOCUS — journée",
    spaceId: new mongoose.Types.ObjectId(),
    buildingId: new mongoose.Types.ObjectId(),
    startAt: new Date("2026-08-10T08:00:00.000Z"),
    endAt: new Date("2026-08-10T18:00:00.000Z"),
    partySize: 2,
    durationClass: "daily" as const,
    units: 1,
    calculatedUnitPriceHT: 25000,
    calculatedTotalHT: 25000,
    calculatedTotalVAT: 5000,
    calculatedTotalTTC: 30000,
    unitPriceHT: 25000,
    qty: 1,
    vatRate: 20,
    discount: 0,
    totalHT: 25000,
    totalVAT: 5000,
    totalTTC: 30000,
    priceSource: "auto" as const,
    ...overrides,
  };
}

describe("QUOTE_STATUSES / CLIENT_ACCOUNT_STATUSES enums", () => {
  it("includes draft as first quote status", () => {
    expect(QUOTE_STATUSES).toEqual(["draft", "sent", "accepted", "refused", "expired"]);
  });

  it("extends ClientAccount statuses with pending_activation (not reuse of locked)", () => {
    expect(CLIENT_ACCOUNT_STATUSES).toEqual([
      "active",
      "locked",
      "anonymized",
      "pending_activation",
    ]);
    expect(CLIENT_ACCOUNT_STATUSES).toContain("pending_activation");
    expect(CLIENT_ACCOUNT_STATUSES.filter((s) => s === "locked")).toHaveLength(1);
  });

  it("declares quote payment methods and line price sources", () => {
    expect(QUOTE_PAYMENT_METHODS).toEqual(["card", "bank_transfer", "direct_debit"]);
    expect(QUOTE_LINE_PRICE_SOURCES).toEqual(["auto", "forced"]);
  });
});

describe("quote schema", () => {
  it("accepts draft without cardex and with prospect", () => {
    const connection = mongoose.createConnection();
    const Quote = registerQuoteModel(connection);
    const doc = new Quote(
      minimalQuoteInput({
        prospect: { email: "prospect@example.com", displayName: "Ada Lovelace" },
        paymentMethodPreferred: "card",
        paymentSituation: "deposit",
        depositPercent: 30,
        depositAmountTTC: 9000,
        internalNote: "staff only",
      }),
    );

    const error = doc.validateSync();
    expect(error).toBeUndefined();
    expect(doc.status).toBe("draft");
    expect(doc.cardexId).toBeUndefined();
    expect(doc.prospect?.email).toBe("prospect@example.com");
    expect(doc.reservationIds).toEqual([]);
    expect(doc.depositPercent).toBe(30);
    void connection.close();
  });

  it("rejects unknown quote status", () => {
    const connection = mongoose.createConnection();
    const Quote = registerQuoteModel(connection);
    const doc = new Quote(minimalQuoteInput({ status: "open" }));
    const error = doc.validateSync();
    expect(error?.errors.status).toBeDefined();
    void connection.close();
  });

  it("rejects depositPercent outside 0–100", () => {
    const connection = mongoose.createConnection();
    const Quote = registerQuoteModel(connection);
    const doc = new Quote(minimalQuoteInput({ depositPercent: 150 }));
    const error = doc.validateSync();
    expect(error?.errors.depositPercent).toBeDefined();
    void connection.close();
  });

  it("accepts multi-space lines with forced price dual fields", () => {
    const connection = mongoose.createConnection();
    const Quote = registerQuoteModel(connection);
    const forcedLine = spaceQuoteLine({
      forcedUnitPriceHT: 20000,
      unitPriceHT: 20000,
      totalHT: 20000,
      totalVAT: 4000,
      totalTTC: 24000,
      priceSource: "forced",
      priceOverrideReason: "Geste commercial",
      priceOverriddenByStaffProfileId: new mongoose.Types.ObjectId(),
      priceOverriddenAt: new Date(),
    });
    const doc = new Quote(
      minimalQuoteInput({
        lines: [forcedLine, spaceQuoteLine({ lineId: "line-2", label: "FOCUS 2" })],
        totals: { ht: 45000, vat: 9000, ttc: 54000, discountTotal: 0 },
      }),
    );

    const error = doc.validateSync();
    expect(error).toBeUndefined();
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines[0]?.priceSource).toBe("forced");
    expect(doc.lines[0]?.calculatedUnitPriceHT).toBe(25000);
    expect(doc.lines[0]?.forcedUnitPriceHT).toBe(20000);
    expect(doc.lines[0]?.spaceId).toBeDefined();
    void connection.close();
  });

  it("requires priceOverrideReason when priceSource is forced", () => {
    const connection = mongoose.createConnection();
    const Quote = registerQuoteModel(connection);

    const missing = new Quote(
      minimalQuoteInput({
        lines: [
          spaceQuoteLine({
            forcedUnitPriceHT: 20000,
            unitPriceHT: 20000,
            totalHT: 20000,
            totalVAT: 4000,
            totalTTC: 24000,
            priceSource: "forced",
          }),
        ],
        totals: { ht: 20000, vat: 4000, ttc: 24000, discountTotal: 0 },
      }),
    );
    expect(missing.validateSync()?.errors["lines.0.priceOverrideReason"]).toBeDefined();

    const empty = new Quote(
      minimalQuoteInput({
        lines: [
          spaceQuoteLine({
            forcedUnitPriceHT: 20000,
            unitPriceHT: 20000,
            totalHT: 20000,
            totalVAT: 4000,
            totalTTC: 24000,
            priceSource: "forced",
            priceOverrideReason: "   ",
          }),
        ],
        totals: { ht: 20000, vat: 4000, ttc: 24000, discountTotal: 0 },
      }),
    );
    expect(empty.validateSync()?.errors["lines.0.priceOverrideReason"]).toBeDefined();

    void connection.close();
  });

  it("rejects non-integer cents on quote line calculated fields", () => {
    const path = quoteLineSchema.path("calculatedUnitPriceHT");
    expect(path?.validators.length).toBeGreaterThan(0);
    expect(CENTS_VALIDATOR.validator(1000)).toBe(true);
    expect(CENTS_VALIDATOR.validator(10.5)).toBe(false);
  });

  it("declares indexes for reference, status, cardex, acceptTokenHash", () => {
    const connection = mongoose.createConnection();
    registerQuoteModel(connection);
    const schema = connection.models.Quote!.schema;
    const indexes = schema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ reference: 1 }, { unique: true }],
        [{ cardexId: 1, createdAt: -1 }, expect.any(Object)],
        [{ status: 1, validUntil: 1 }, expect.any(Object)],
        [{ acceptTokenHash: 1 }, expect.objectContaining({ unique: true, sparse: true })],
      ]),
    );
    void connection.close();
  });
});

describe("reservation / invoice quoteId foundation", () => {
  it("declares quoteId on reservation with index", () => {
    const connection = mongoose.createConnection();
    registerReservationModel(connection);
    const schema = connection.models.Reservation!.schema;
    expect(schema.path("quoteId")).toBeDefined();
    expect(schema.indexes()).toEqual(
      expect.arrayContaining([[{ quoteId: 1 }, expect.any(Object)]]),
    );
    void connection.close();
  });

  it("declares quoteId and reservationIds on invoice", () => {
    const connection = mongoose.createConnection();
    registerInvoiceModel(connection);
    const schema = connection.models.Invoice!.schema;
    expect(schema.path("quoteId")).toBeDefined();
    expect(schema.path("reservationIds")).toBeDefined();
    expect(schema.indexes()).toEqual(
      expect.arrayContaining([[{ quoteId: 1 }, expect.any(Object)]]),
    );
    void connection.close();
  });
});

describe("clientAccount pending_activation status", () => {
  it("accepts pending_activation in schema enum", () => {
    const connection = mongoose.createConnection();
    registerClientAccountModel(connection);
    const statusPath = connection.models.ClientAccount!.schema.path("status") as {
      enumValues?: string[];
      options?: { enum?: string[] };
    };
    const values = statusPath.enumValues ?? statusPath.options?.enum ?? [];
    expect(values).toContain("pending_activation");
    expect(values).toContain("locked");
    void connection.close();
  });
});
