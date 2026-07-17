import { describe, expect, it } from "vitest";

import { matchQontoCredit } from "./qonto-matching.js";

describe("matchQontoCredit", () => {
  it("suggests exact match when reference and amount align", () => {
    const result = matchQontoCredit({
      observedTexts: ["Virement RES-2026-00042"],
      amountCents: 15_000,
      pending: {
        reservationReference: "RES-2026-00042",
        amountDueCents: 15_000,
        invoiceId: "inv1",
        reservationId: "res1",
      },
    });

    expect(result).toEqual({
      kind: "exact",
      reservationReference: "RES-2026-00042",
      amountDueCents: 15_000,
      invoiceId: "inv1",
      reservationId: "res1",
      observedLabel: "Virement RES-2026-00042",
    });
  });

  it("flags amount_mismatch when reference matches but amount differs — never auto-confirms", () => {
    const result = matchQontoCredit({
      observedTexts: ["RES-2026-00042", "note client"],
      amountCents: 14_000,
      pending: {
        reservationReference: "RES-2026-00042",
        amountDueCents: 15_000,
        invoiceId: "inv1",
        reservationId: "res1",
      },
    });

    expect(result.kind).toBe("amount_mismatch");
    expect(result.reservationReference).toBe("RES-2026-00042");
    expect(result.amountDueCents).toBe(15_000);
    expect(result.kind).not.toBe("exact");
  });

  it("returns no_reservation when label has no RES reference (manual fallback)", () => {
    const result = matchQontoCredit({
      observedTexts: ["Paiement fournisseur"],
      amountCents: 15_000,
      pending: {
        reservationReference: "RES-2026-00042",
        amountDueCents: 15_000,
        invoiceId: "inv1",
        reservationId: "res1",
      },
    });

    expect(result).toEqual({
      kind: "no_reservation",
      reservationReference: null,
      observedLabel: "Paiement fournisseur",
    });
  });

  it("returns no_reservation when RES exists but no pending bank-transfer invoice", () => {
    const result = matchQontoCredit({
      observedTexts: ["RES-2026-00999"],
      amountCents: 15_000,
      pending: null,
    });

    expect(result.kind).toBe("no_reservation");
    expect(result.reservationReference).toBe("RES-2026-00999");
  });
});
