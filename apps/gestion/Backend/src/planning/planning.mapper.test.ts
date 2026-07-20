import { describe, expect, it } from "vitest";

import {
  formatClientLabel,
  isReservationReadOnly,
  mapInvoicePaymentStatus,
  mergeContactAccountIds,
  splitReservationSubtotalHT,
} from "./planning.mapper.js";

describe("planning.mapper", () => {
  it("maps invoice payment status for calendar colors", () => {
    expect(
      mapInvoicePaymentStatus({
        invoiceStatus: "paid",
        paidTotal: 2400,
        balanceDue: 0,
        reservationStatus: "confirmed",
      }),
    ).toBe("paid");

    expect(
      mapInvoicePaymentStatus({
        invoiceStatus: "partially_paid",
        paidTotal: 1000,
        balanceDue: 1400,
        reservationStatus: "confirmed",
      }),
    ).toBe("partially_paid");

    expect(
      mapInvoicePaymentStatus({
        invoiceStatus: "proforma",
        paidTotal: 0,
        balanceDue: 2400,
        reservationStatus: "awaiting_payment",
      }),
    ).toBe("awaiting_payment");

    expect(
      mapInvoicePaymentStatus({
        reservationStatus: "cancelled",
      }),
    ).toBe("none");
  });

  it("formats client labels without floats", () => {
    expect(
      formatClientLabel({
        companyName: "ACME",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).toBe("ACME");
    expect(formatClientLabel({ firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace");
  });

  it("marks terminated reservations as read-only", () => {
    expect(isReservationReadOnly("completed")).toBe(true);
    expect(isReservationReadOnly("cancelled")).toBe(true);
    expect(isReservationReadOnly("confirmed")).toBe(false);
  });

  it("merges company contacts without dropping the reservation booker", () => {
    const merged = mergeContactAccountIds([
      { id: "booker", via: "reservation" },
      { id: "colleague", via: "cardex" },
      { id: "booker", via: "cardex" },
      { id: "colleague", via: "cardex" },
    ]);
    expect(merged.get("booker")).toBe("reservation");
    expect(merged.get("colleague")).toBe("cardex");
    expect(merged.size).toBe(2);
  });

  it("splits subtotalHT into space + services from stored snapshots", () => {
    expect(
      splitReservationSubtotalHT({
        subtotalHT: 19_999,
        services: [{ qty: 1, unitPriceHT: 1_999 }],
        invoiceSpaceLines: [{ qty: 1, unitPriceHT: 18_000 }],
      }),
    ).toEqual({ spaceHT: 18_000, servicesHT: 1_999 });

    expect(
      splitReservationSubtotalHT({
        subtotalHT: 20_000,
        services: [{ qty: 2, unitPriceHT: 500 }],
      }),
    ).toEqual({ spaceHT: 19_000, servicesHT: 1_000 });
  });
});
