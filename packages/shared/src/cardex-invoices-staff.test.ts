import { describe, expect, it } from "vitest";

import { StaffCardexInvoicesListResponseSchema } from "./cardex-invoices-staff.js";

describe("cardex-invoices-staff schemas", () => {
  it("accepts an empty invoices list", () => {
    expect(StaffCardexInvoicesListResponseSchema.parse({ invoices: [] })).toEqual({
      invoices: [],
    });
  });

  it("accepts a staff invoice list item", () => {
    const parsed = StaffCardexInvoicesListResponseSchema.parse({
      invoices: [
        {
          id: "507f1f77bcf86cd799439011",
          reference: "PF-2026-00024",
          type: "proforma",
          status: "paid",
          totals: {
            ht: 100,
            vat: 20,
            ttc: 120,
            discountTotal: 0,
            paidTotal: 120,
            balanceDue: 0,
          },
          issuedAt: "2026-07-21T08:13:13.500Z",
          reservationId: "507f1f77bcf86cd799439012",
        },
      ],
    });
    expect(parsed.invoices[0]?.reference).toBe("PF-2026-00024");
  });
});
