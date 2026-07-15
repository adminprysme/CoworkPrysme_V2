import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { clientAccountEmailExistsMock, verifyClientAccountCredentialsMock } = vi.hoisted(() => ({
  clientAccountEmailExistsMock: vi.fn(),
  verifyClientAccountCredentialsMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  clientAccountEmailExists: clientAccountEmailExistsMock,
  verifyClientAccountCredentials: verifyClientAccountCredentialsMock,
}));

import { BookingAccountService } from "./booking-account.service.js";

describe("BookingAccountService", () => {
  let service: BookingAccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BookingAccountService();
  });

  it("returns exists=true when email is registered", async () => {
    clientAccountEmailExistsMock.mockResolvedValue(true);
    await expect(service.checkEmail({ email: "a@example.com" })).resolves.toEqual({
      exists: true,
    });
  });

  it("throws UnauthorizedException when verify fails", async () => {
    verifyClientAccountCredentialsMock.mockResolvedValue(false);
    await expect(
      service.verifyAccount({ email: "a@example.com", password: "WrongPass1!" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("returns valid=true when credentials match", async () => {
    verifyClientAccountCredentialsMock.mockResolvedValue(true);
    await expect(
      service.verifyAccount({ email: "a@example.com", password: "GoodPass1!" }),
    ).resolves.toEqual({ valid: true });
  });
});
