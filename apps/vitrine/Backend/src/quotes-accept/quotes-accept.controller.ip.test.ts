import "reflect-metadata";

import { type INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./quotes-accept.service.js", () => ({
  QuotesAcceptService: class QuotesAcceptService {},
}));

import { QuotesAcceptController } from "./quotes-accept.controller.js";
import { QuotesAcceptService } from "./quotes-accept.service.js";

/**
 * IP capture on client self-service accept — trust proxy + X-Forwarded-For.
 */
describe("QuotesAcceptController client IP capture", () => {
  let app: INestApplication;
  let baseUrl: string;
  const confirmMock = vi.fn();
  const confirmLoginMock = vi.fn();
  const registerMock = vi.fn();

  beforeAll(async () => {
    confirmMock.mockResolvedValue({ status: "accepted" });
    confirmLoginMock.mockResolvedValue({ status: "accepted" });
    registerMock.mockResolvedValue({
      clientAccount: { id: "a".repeat(24), email: "a@b.co", status: "active" },
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [QuotesAcceptController],
      providers: [
        {
          provide: QuotesAcceptService,
          useValue: {
            confirm: confirmMock,
            confirmExistingWithPassword: confirmLoginMock,
            register: registerMock,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    (app as NestExpressApplication).set("trust proxy", 1);
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock.mockResolvedValue({ status: "accepted" });
    confirmLoginMock.mockResolvedValue({ status: "accepted" });
    registerMock.mockResolvedValue({
      clientAccount: { id: "a".repeat(24), email: "a@b.co", status: "active" },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const token = "c".repeat(64);

  it("POST confirm forwards req.ip (via X-Forwarded-For) to accept options", async () => {
    const response = await fetch(`${baseUrl}/quotes/accept/${token}/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.55",
      },
      body: JSON.stringify({ clientAccountId: "b".repeat(24) }),
    });

    expect(response.status).toBe(201);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledWith(
      token,
      { clientAccountId: "b".repeat(24) },
      { ipAddress: "203.0.113.55" },
    );
  });

  it("POST confirm-login forwards req.ip to accept options", async () => {
    const response = await fetch(`${baseUrl}/quotes/accept/${token}/confirm-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "198.51.100.9",
      },
      body: JSON.stringify({ email: "client@example.com", password: "Secret123!" }),
    });

    expect(response.status).toBe(201);
    expect(confirmLoginMock).toHaveBeenCalledTimes(1);
    expect(confirmLoginMock).toHaveBeenCalledWith(
      token,
      { email: "client@example.com", password: "Secret123!" },
      { ipAddress: "198.51.100.9" },
    );
  });

  it("POST register does not capture IP (not an accept)", async () => {
    const response = await fetch(`${baseUrl}/quotes/accept/${token}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.99",
      },
      body: JSON.stringify({
        password: "Secret123!",
        firstName: "Alice",
        lastName: "Martin",
        privacyPolicyAccepted: true,
        cgvAccepted: true,
      }),
    });

    expect(response.status).toBe(201);
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock.mock.calls[0]).toHaveLength(2);
    expect(registerMock.mock.calls[0]![0]).toBe(token);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(confirmLoginMock).not.toHaveBeenCalled();
  });
});
