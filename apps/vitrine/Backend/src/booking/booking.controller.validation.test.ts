import "reflect-metadata";

import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./booking.service.js", () => ({
  BookingService: class BookingService {},
}));

vi.mock("./booking-catalog.service.js", () => ({
  BookingCatalogService: class BookingCatalogService {},
}));

vi.mock("./booking-price.service.js", () => ({
  BookingPriceService: class BookingPriceService {},
}));

vi.mock("./booking-account.service.js", () => ({
  BookingAccountService: class BookingAccountService {},
}));

vi.mock("./booking-confirm.service.js", () => ({
  BookingConfirmService: class BookingConfirmService {},
}));

import { ZodValidationExceptionFilter } from "../common/zod-validation.exception-filter.js";
import { BookingAccountService } from "./booking-account.service.js";
import { BookingCatalogService } from "./booking-catalog.service.js";
import { BookingConfirmService } from "./booking-confirm.service.js";
import { BookingController } from "./booking.controller.js";
import { BookingPriceService } from "./booking-price.service.js";
import { BookingService } from "./booking.service.js";

describe("BookingController Zod validation", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        { provide: BookingService, useValue: {} },
        { provide: BookingCatalogService, useValue: {} },
        { provide: BookingPriceService, useValue: {} },
        { provide: BookingAccountService, useValue: {} },
        { provide: BookingConfirmService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ZodValidationExceptionFilter());
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function post(path: string, body: unknown) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      json: (await response.json()) as Record<string, unknown>,
    };
  }

  it("POST /booking/price returns 400 VALIDATION_ERROR for invalid body", async () => {
    const result = await post("/booking/price", {
      spaceId: "not-an-objectid",
      startAt: "2026-07-18T06:00:00.000Z",
      endAt: "2026-07-18T17:00:00.000Z",
      durationClass: "halfday",
      services: [],
    });

    expect(result.status).toBe(400);
    expect(result.json).toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      errors: expect.any(Array),
    });
  });

  it("POST /booking/lock returns 400 VALIDATION_ERROR for invalid body", async () => {
    const result = await post("/booking/lock", {
      spaceId: "bad-id",
      startAt: "2026-07-18T06:00:00.000Z",
      endAt: "2026-07-18T17:00:00.000Z",
      sessionId: "abc",
      partySize: 2,
    });

    expect(result.status).toBe(400);
    expect(result.json.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(result.json.errors)).toBe(true);
  });

  it("POST /booking/confirm returns 400 VALIDATION_ERROR for invalid body", async () => {
    const result = await post("/booking/confirm", {
      lockId: "bad",
      sessionId: "abc",
      spaceId: "bad",
      startAt: "2026-07-18T06:00:00.000Z",
      endAt: "2026-07-18T06:00:00.000Z",
      durationClass: "hourly",
      partySize: 2,
      services: [],
      accountMode: "new",
      email: "not-an-email",
      password: "short",
      cgvAccepted: true,
      withdrawalAcknowledged: true,
      paymentMethod: "card",
    });

    expect(result.status).toBe(400);
    expect(result.json.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(result.json.errors)).toBe(true);
  });

  it("POST /booking/confirm rejects retired paymentMethod proforma", async () => {
    const result = await post("/booking/confirm", {
      lockId: "507f1f77bcf86cd799439011",
      sessionId: "session-abcdefgh",
      spaceId: "507f1f77bcf86cd799439012",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-01T11:00:00.000Z",
      durationClass: "hourly",
      partySize: 2,
      services: [],
      accountMode: "new",
      email: "client@example.com",
      password: "SecretPass1!",
      identity: { firstName: "Ada", lastName: "Lovelace" },
      clientKind: "individual",
      address: { street: "10 rue X", zip: "69001", city: "Lyon", country: "FR" },
      privacyPolicyAccepted: true,
      cgvAccepted: true,
      withdrawalAcknowledged: true,
      paymentMethod: "proforma",
    });

    expect(result.status).toBe(400);
    expect(result.json.code).toBe("VALIDATION_ERROR");
  });
});
