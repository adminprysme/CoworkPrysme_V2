/**
 * Build optional proforma PDF attachments for Planning Manage emails.
 * Reuses `@coworkprysme/invoice-pdf` — call only AFTER the invoice document
 * has been persisted with the financial change for this manage action.
 */
import type { InvoicePdfService } from "@coworkprysme/invoice-pdf";

import type { MailAttachment } from "../mail/mail.service.js";

export async function buildProformaPdfAttachments(
  invoicePdf: Pick<InvoicePdfService, "generatePdfForInvoiceReference">,
  invoiceReference: string | null | undefined,
  onError?: (error: unknown) => void,
): Promise<MailAttachment[] | undefined> {
  const reference = invoiceReference?.trim();
  if (!reference) {
    return undefined;
  }

  try {
    const { pdf, model } = await invoicePdf.generatePdfForInvoiceReference(reference);
    return [
      {
        filename: `${model.invoiceReference}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ];
  } catch (error) {
    onError?.(error);
    return undefined;
  }
}
