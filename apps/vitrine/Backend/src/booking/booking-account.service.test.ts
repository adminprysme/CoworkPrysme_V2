import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientAccountEmailExistsMock,
  verifyClientAccountCredentialsMock,
  AccountLockedError,
  AccountPendingActivationError,
} = vi.hoisted(() => {
  class AccountLockedError extends Error {
    constructor() {
      super("locked");
      this.name = "AccountLockedError";
    }
  }
  class AccountPendingActivationError extends Error {
    constructor() {
      super("pending");
      this.name = "AccountPendingActivationError";
    }
  }
  return {
    clientAccountEmailExistsMock: vi.fn(),
    verifyClientAccountCredentialsMock: vi.fn(),
    AccountLockedError,
    AccountPendingActivationError,
  };
});

vi.mock("@coworkprysme/db", () => ({
  clientAccountEmailExists: clientAccountEmailExistsMock,
  verifyClientAccountCredentials: verifyClientAccountCredentialsMock,
  AccountLockedError,
  AccountPendingActivationError,
}));

import {
  BOOKING_CONFIRM_ERROR_CODES,
  CLIENT_ACCOUNT_LOCKED_USER_MESSAGE,
  CLIENT_ACCOUNT_PENDING_ACTIVATION_USER_MESSAGE,
} from "@coworkprysme/shared";
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

  it("throws ForbiddenException ACCOUNT_LOCKED when account is locked", async () => {
    verifyClientAccountCredentialsMock.mockRejectedValue(new AccountLockedError());
    const err = await service
      .verifyAccount({ email: "a@example.com", password: "AnyPass1!" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    const body = (err as ForbiddenException).getResponse() as {
      code?: string;
      message?: string;
    };
    expect(body.code).toBe(BOOKING_CONFIRM_ERROR_CODES.ACCOUNT_LOCKED);
    expect(body.message).toBe(CLIENT_ACCOUNT_LOCKED_USER_MESSAGE);
  });

  it("throws ForbiddenException ACCOUNT_PENDING_ACTIVATION when pending", async () => {
    verifyClientAccountCredentialsMock.mockRejectedValue(new AccountPendingActivationError());
    const err = await service
      .verifyAccount({ email: "a@example.com", password: "AnyPass1!" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    const body = (err as ForbiddenException).getResponse() as {
      code?: string;
      message?: string;
    };
    expect(body.code).toBe(BOOKING_CONFIRM_ERROR_CODES.ACCOUNT_PENDING_ACTIVATION);
    expect(body.message).toBe(CLIENT_ACCOUNT_PENDING_ACTIVATION_USER_MESSAGE);
    expect(body.message).not.toBe(CLIENT_ACCOUNT_LOCKED_USER_MESSAGE);
  });

  it("returns valid=true when credentials match", async () => {
    verifyClientAccountCredentialsMock.mockResolvedValue(true);
    await expect(
      service.verifyAccount({ email: "a@example.com", password: "GoodPass1!" }),
    ).resolves.toEqual({ valid: true });
  });
});
