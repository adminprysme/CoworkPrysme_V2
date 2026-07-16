import {
  DEFAULT_BANK_TRANSFER_MIN_LEAD_DAYS,
  DEFAULT_BANK_TRANSFER_PAYMENT_WINDOW_DAYS,
  DEFAULT_BANK_TRANSFER_SAFETY_MARGIN_DAYS,
  isBankTransferFullyEligible,
  type BookingPaymentMethod,
} from "@coworkprysme/shared";

export interface BankTransferRibConfig {
  iban: string;
  bic: string;
  accountHolder: string;
  bankName?: string;
}

export interface BankTransferThresholds {
  minLeadDays: number;
  paymentWindowDays: number;
  safetyMarginDays: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Load RIB from env — null when not fully configured (option must stay hidden). */
export function loadBankTransferRibConfig(
  env: NodeJS.ProcessEnv = process.env,
): BankTransferRibConfig | null {
  const iban = env.BANK_TRANSFER_IBAN?.trim() ?? "";
  const bic = env.BANK_TRANSFER_BIC?.trim() ?? "";
  const accountHolder = env.BANK_TRANSFER_ACCOUNT_HOLDER?.trim() ?? "";
  const bankName = env.BANK_TRANSFER_BANK_NAME?.trim() || undefined;
  if (!iban || !bic || !accountHolder) {
    return null;
  }
  return { iban, bic, accountHolder, bankName };
}

export function loadBankTransferThresholds(
  env: NodeJS.ProcessEnv = process.env,
): BankTransferThresholds {
  return {
    minLeadDays: parsePositiveInt(
      env.BANK_TRANSFER_MIN_LEAD_DAYS,
      DEFAULT_BANK_TRANSFER_MIN_LEAD_DAYS,
    ),
    paymentWindowDays: parsePositiveInt(
      env.BANK_TRANSFER_PAYMENT_WINDOW_DAYS,
      DEFAULT_BANK_TRANSFER_PAYMENT_WINDOW_DAYS,
    ),
    safetyMarginDays: parsePositiveInt(
      env.BANK_TRANSFER_SAFETY_MARGIN_DAYS,
      DEFAULT_BANK_TRANSFER_SAFETY_MARGIN_DAYS,
    ),
  };
}

/** Tunnel payment methods — bank_transfer only when RIB configured and fully eligible. */
export function resolveAvailablePaymentMethods(
  startAt: Date,
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): {
  paymentMethods: BookingPaymentMethod[];
  bankTransferAvailable: boolean;
  minLeadDays: number;
} {
  const thresholds = loadBankTransferThresholds(env);
  const rib = loadBankTransferRibConfig(env);
  const methods: BookingPaymentMethod[] = ["proforma", "card"];
  const bankTransferAvailable =
    rib !== null &&
    isBankTransferFullyEligible({
      startAt,
      now,
      minLeadDays: thresholds.minLeadDays,
      paymentWindowDays: thresholds.paymentWindowDays,
      safetyMarginDays: thresholds.safetyMarginDays,
    });
  if (bankTransferAvailable) {
    methods.push("bank_transfer");
  }
  return {
    paymentMethods: methods,
    bankTransferAvailable,
    minLeadDays: thresholds.minLeadDays,
  };
}
