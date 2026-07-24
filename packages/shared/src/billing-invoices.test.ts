import { describe, expect, it } from "vitest";

import {
  StaffBillingInvoiceListQuerySchema,
  StaffBillingInvoiceListResponseSchema,
  StaffPaymentMethodSchema,
} from "./billing-invoices.js";

describe("StaffBillingInvoiceListQuerySchema", () => {
  it("accepts q + paymentMethod + status + issued range", () => {
    expect(
      StaffBillingInvoiceListQuerySchema.parse({
        q: "PF-2026",
        paymentMethod: "card",
        status: "partially_paid",
        issuedFrom: "2026-07-01T00:00:00.000Z",
        issuedTo: "2026-07-31T23:59:59.000Z",
        page: "1",
        pageSize: "20",
      }),
    ).toEqual({
      q: "PF-2026",
      paymentMethod: "card",
      status: "partially_paid",
      issuedFrom: "2026-07-01T00:00:00.000Z",
      issuedTo: "2026-07-31T23:59:59.000Z",
      page: 1,
      pageSize: 20,
    });
  });

  it("defaults pagination", () => {
    expect(StaffBillingInvoiceListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 50,
    });
  });
});

describe("StaffBillingInvoiceListResponseSchema", () => {
  it("requires summary aggregates for KPI cards", () => {
    const parsed = StaffBillingInvoiceListResponseSchema.parse({
      invoices: [],
      total: 0,
      page: 1,
      pageSize: 50,
      summary: { invoiceCount: 0, balanceDueCents: 0, paidTotalCents: 0 },
    });
    expect(parsed.summary.invoiceCount).toBe(0);
  });
});

describe("StaffPaymentMethodSchema", () => {
  it("mirrors Payment.method enum", () => {
    expect(StaffPaymentMethodSchema.options).toEqual([
      "card",
      "transfer",
      "direct_debit",
      "cash",
      "manual",
    ]);
  });
});
