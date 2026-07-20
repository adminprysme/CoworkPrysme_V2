export interface InvoiceIssuerConfig {
  legalName: string;
  legalForm: string;
  shareCapital: string;
  addressLine1: string;
  addressLine2?: string;
  siret: string;
  vatNumber: string;
  rcs: string;
  email?: string;
  phone?: string;
}

/**
 * Issuer identity for PDF invoices — all required fields must be set in env.
 * Returns null when incomplete (PDF generation should fail clearly).
 */
export function loadInvoiceIssuerConfig(
  env: NodeJS.ProcessEnv = process.env,
): InvoiceIssuerConfig | null {
  const legalName = env.INVOICE_ISSUER_LEGAL_NAME?.trim() ?? "";
  const legalForm = env.INVOICE_ISSUER_LEGAL_FORM?.trim() ?? "";
  const shareCapital = env.INVOICE_ISSUER_SHARE_CAPITAL?.trim() ?? "";
  const addressLine1 = env.INVOICE_ISSUER_ADDRESS_LINE1?.trim() ?? "";
  const addressLine2 = env.INVOICE_ISSUER_ADDRESS_LINE2?.trim() || undefined;
  const siret = env.INVOICE_ISSUER_SIRET?.trim() ?? "";
  const vatNumber = env.INVOICE_ISSUER_VAT_NUMBER?.trim() ?? "";
  const rcs = env.INVOICE_ISSUER_RCS?.trim() ?? "";
  const email = env.INVOICE_ISSUER_EMAIL?.trim() || undefined;
  const phone = env.INVOICE_ISSUER_PHONE?.trim() || undefined;

  if (!legalName || !legalForm || !shareCapital || !addressLine1 || !siret || !vatNumber || !rcs) {
    return null;
  }

  return {
    legalName,
    legalForm,
    shareCapital,
    addressLine1,
    addressLine2,
    siret,
    vatNumber,
    rcs,
    email,
    phone,
  };
}
