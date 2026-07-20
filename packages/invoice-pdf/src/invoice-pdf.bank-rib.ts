import type { InvoicePdfBankRibView } from "./invoice-pdf.types.js";

/** RIB from env for proforma PDF (same vars as booking bank-transfer config). */
export function loadInvoicePdfBankRib(
  env: NodeJS.ProcessEnv = process.env,
): InvoicePdfBankRibView | null {
  const iban = env.BANK_TRANSFER_IBAN?.trim() ?? "";
  const bic = env.BANK_TRANSFER_BIC?.trim() ?? "";
  const accountHolder = env.BANK_TRANSFER_ACCOUNT_HOLDER?.trim() ?? "";
  const bankName = env.BANK_TRANSFER_BANK_NAME?.trim() || undefined;
  if (!iban || !bic || !accountHolder) {
    return null;
  }
  return { iban, bic, accountHolder, bankName };
}
