import "reflect-metadata";

import { NotFoundException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { QUOTE_ACCEPT_ERROR_CODES } from "@coworkprysme/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./quotes-accept.service.js", () => ({
  QuotesAcceptService: class QuotesAcceptService {},
}));

import { QuotesAcceptController } from "./quotes-accept.controller.js";
import { QuotesAcceptService } from "./quotes-accept.service.js";

/**
 * Light HTTP Nest tests (#10) — accept preview 404 for unknown token.
 */
describe("QuotesAcceptController HTTP 404", () => {
  let app: INestApplication;
  let baseUrl: string;
  const previewMock = vi.fn();

  beforeAll(async () => {
    previewMock.mockRejectedValue(
      new NotFoundException({
        code: QUOTE_ACCEPT_ERROR_CODES.QUOTE_ACCEPT_NOT_FOUND,
        message: "Lien d'acceptation invalide ou introuvable.",
      }),
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [QuotesAcceptController],
      providers: [{ provide: QuotesAcceptService, useValue: { preview: previewMock } }],
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

  it("GET /quotes/accept/:token returns 404 for unknown accept token", async () => {
    const token = "c".repeat(64);
    const response = await fetch(`${baseUrl}/quotes/accept/${token}`);
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(json).toMatchObject({
      message: expect.stringMatching(/introuvable|invalide/i),
    });
    expect(previewMock).toHaveBeenCalledWith(token);
  });
});
