import { afterEach, describe, expect, it } from "vitest";

import {
  loadBankTransferRibConfig,
  loadBankTransferThresholds,
  resolveAvailablePaymentMethods,
} from "./bank-transfer.config.js";

describe("bank transfer config + eligibility", () => {
  afterEach(() => {
    delete process.env.BANK_TRANSFER_IBAN;
    delete process.env.BANK_TRANSFER_BIC;
    delete process.env.BANK_TRANSFER_ACCOUNT_HOLDER;
    delete process.env.BANK_TRANSFER_BANK_NAME;
    delete process.env.BANK_TRANSFER_MIN_LEAD_DAYS;
    delete process.env.BANK_TRANSFER_PAYMENT_WINDOW_DAYS;
    delete process.env.BANK_TRANSFER_SAFETY_MARGIN_DAYS;
  });

  it("returns null RIB when env incomplete", () => {
    expect(
      loadBankTransferRibConfig({
        BANK_TRANSFER_IBAN: "FR76",
        BANK_TRANSFER_BIC: "",
        BANK_TRANSFER_ACCOUNT_HOLDER: "Cowork",
      }),
    ).toBeNull();
  });

  it("loads thresholds from env with defaults", () => {
    expect(loadBankTransferThresholds({})).toEqual({
      minLeadDays: 7,
      paymentWindowDays: 8,
      safetyMarginDays: 2,
    });
    expect(
      loadBankTransferThresholds({
        BANK_TRANSFER_MIN_LEAD_DAYS: "10",
        BANK_TRANSFER_PAYMENT_WINDOW_DAYS: "9",
        BANK_TRANSFER_SAFETY_MARGIN_DAYS: "3",
      }),
    ).toEqual({ minLeadDays: 10, paymentWindowDays: 9, safetyMarginDays: 3 });
  });

  it("hides bank_transfer when start is only 3 days away", () => {
    const env = {
      BANK_TRANSFER_IBAN: "FR761234567890",
      BANK_TRANSFER_BIC: "QNTOFRP1",
      BANK_TRANSFER_ACCOUNT_HOLDER: "Cowork Prysme",
      BANK_TRANSFER_MIN_LEAD_DAYS: "7",
      BANK_TRANSFER_PAYMENT_WINDOW_DAYS: "8",
      BANK_TRANSFER_SAFETY_MARGIN_DAYS: "2",
    };
    const now = new Date("2026-07-16T10:00:00.000Z");
    const start = new Date("2026-07-19T10:00:00.000Z");
    const result = resolveAvailablePaymentMethods(start, now, env);
    expect(result.paymentMethods).toEqual(["proforma", "card"]);
    expect(result.bankTransferAvailable).toBe(false);
  });

  it("offers bank_transfer when start is 10 days away and RIB configured", () => {
    const env = {
      BANK_TRANSFER_IBAN: "FR761234567890",
      BANK_TRANSFER_BIC: "QNTOFRP1",
      BANK_TRANSFER_ACCOUNT_HOLDER: "Cowork Prysme",
      BANK_TRANSFER_MIN_LEAD_DAYS: "7",
      BANK_TRANSFER_PAYMENT_WINDOW_DAYS: "8",
      BANK_TRANSFER_SAFETY_MARGIN_DAYS: "2",
    };
    const now = new Date("2026-07-16T10:00:00.000Z");
    const start = new Date("2026-07-26T10:00:00.000Z");
    const result = resolveAvailablePaymentMethods(start, now, env);
    expect(result.paymentMethods).toContain("bank_transfer");
    expect(result.bankTransferAvailable).toBe(true);
  });

  it("rejects exact-lead margin when safety window would be empty", () => {
    const env = {
      BANK_TRANSFER_IBAN: "FR761234567890",
      BANK_TRANSFER_BIC: "QNTOFRP1",
      BANK_TRANSFER_ACCOUNT_HOLDER: "Cowork Prysme",
      BANK_TRANSFER_MIN_LEAD_DAYS: "7",
      BANK_TRANSFER_PAYMENT_WINDOW_DAYS: "8",
      BANK_TRANSFER_SAFETY_MARGIN_DAYS: "7",
    };
    const now = new Date("2026-07-16T10:00:00.000Z");
    // Lead time OK (exactly 7 days) but start−7d == issuedAt → empty payment window
    const start = new Date("2026-07-23T10:00:00.000Z");
    const result = resolveAvailablePaymentMethods(start, now, env);
    expect(result.bankTransferAvailable).toBe(false);
    expect(result.paymentMethods).not.toContain("bank_transfer");
  });
});
