import "reflect-metadata";

import { NotFoundException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { QUOTE_PAYMENT_LINK_ERROR_CODES } from "@coworkprysme/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./quote-payment.service.js", () => ({
  QuotePaymentService: class QuotePaymentService {},
}));

import { QuotePaymentController } from "./quote-payment.controller.js";
import { QuotePaymentService } from "./quote-payment.service.js";

/**
 * Light HTTP Nest tests (#10) — pattern booking.controller.validation.test.ts.
 * Domain cross-invoice 404: packages/db quote-payment-link.integration.test.ts
 */
describe("QuotePaymentController HTTP 404", () => {
  let app: INestApplication;
  let baseUrl: string;
  const previewMock = vi.fn();

  const GOOD_TOKEN = "a".repeat(64);
  const WRONG_INVOICE_ID = "507f1f77bcf86cd799439099";

  beforeAll(async () => {
    previewMock.mockImplementation(async (query: { token: string; invoiceId: string }) => {
      if (query.invoiceId === WRONG_INVOICE_ID || query.token !== GOOD_TOKEN) {
        throw new NotFoundException({
          code: QUOTE_PAYMENT_LINK_ERROR_CODES.PAYMENT_LINK_NOT_FOUND,
          message: "Lien de paiement introuvable.",
        });
      }
      throw new Error("unexpected preview call in 404 suite");
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [QuotePaymentController],
      providers: [{ provide: QuotePaymentService, useValue: { preview: previewMock } }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /quotes/payments/preview returns 404 for wrong invoiceId (cross-invoice)", async () => {
    const url = new URL("/quotes/payments/preview", baseUrl);
    url.searchParams.set("token", GOOD_TOKEN);
    url.searchParams.set("invoiceId", WRONG_INVOICE_ID);

    const response = await fetch(url);
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(json).toMatchObject({
      message: expect.stringMatching(/introuvable/i),
    });
    // Production throws NotFoundException({ code, message }) — code may be top-level or nested.
    const code =
      (json as { code?: string }).code ??
      (typeof json.message === "object" && json.message !== null
        ? (json.message as { code?: string }).code
        : undefined);
    if (code !== undefined) {
      expect(code).toBe(QUOTE_PAYMENT_LINK_ERROR_CODES.PAYMENT_LINK_NOT_FOUND);
    }
    expect(previewMock).toHaveBeenCalledWith({
      token: GOOD_TOKEN,
      invoiceId: WRONG_INVOICE_ID,
    });
  });

  it("GET /quotes/payments/preview returns 404 for unknown payment token", async () => {
    const unknownToken = "b".repeat(64);
    const url = new URL("/quotes/payments/preview", baseUrl);
    url.searchParams.set("token", unknownToken);
    url.searchParams.set("invoiceId", "507f1f77bcf86cd799439011");

    const response = await fetch(url);
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(json).toMatchObject({
      message: expect.stringMatching(/introuvable/i),
    });
  });
});
