import { describe, expect, it } from "vitest";

import { buildPaymentQrDataUri } from "./invoice-pdf.qr.js";

describe("buildPaymentQrDataUri", () => {
  it("returns a PNG data-URL for a payment URL", async () => {
    const uri = await buildPaymentQrDataUri(
      "http://localhost:3001/payer-devis?token=abc&invoiceId=507f1f77bcf86cd799439012",
    );
    expect(uri.startsWith("data:image/png;base64,")).toBe(true);
    expect(uri.length).toBeGreaterThan(100);
  });
});
