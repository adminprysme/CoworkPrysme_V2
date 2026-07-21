import { describe, expect, it, vi } from "vitest";

import { buildProformaPdfAttachments } from "./planning-manage-mail-attachments.js";

describe("buildProformaPdfAttachments", () => {
  it("returns undefined when invoice reference is missing", async () => {
    const invoicePdf = { generatePdfForInvoiceReference: vi.fn() };
    await expect(buildProformaPdfAttachments(invoicePdf, null)).resolves.toBeUndefined();
    await expect(buildProformaPdfAttachments(invoicePdf, "  ")).resolves.toBeUndefined();
    expect(invoicePdf.generatePdfForInvoiceReference).not.toHaveBeenCalled();
  });

  it("returns a PDF attachment after successful generation", async () => {
    const invoicePdf = {
      generatePdfForInvoiceReference: vi.fn().mockResolvedValue({
        pdf: Buffer.from("%PDF-1.4 updated-proforma"),
        model: { invoiceReference: "PF-2026-MANAGE" },
        html: "<html></html>",
      }),
    };

    const attachments = await buildProformaPdfAttachments(invoicePdf, "PF-2026-MANAGE");
    expect(attachments).toHaveLength(1);
    expect(attachments?.[0]?.filename).toBe("PF-2026-MANAGE.pdf");
    expect(attachments?.[0]?.contentType).toBe("application/pdf");
    expect(attachments?.[0]?.content.toString()).toContain("%PDF");
  });

  it("swallows PDF errors and returns undefined (email still sendable)", async () => {
    const onError = vi.fn();
    const invoicePdf = {
      generatePdfForInvoiceReference: vi.fn().mockRejectedValue(new Error("playwright down")),
    };

    await expect(
      buildProformaPdfAttachments(invoicePdf, "PF-2026-MANAGE", onError),
    ).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
  });
});
