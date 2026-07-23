import { beforeEach, describe, expect, it, vi } from "vitest";

const findOneMock = vi.fn();

vi.mock("../../connection.js", () => ({
  connectMongo: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../client/client-account.schema.js", () => ({
  getClientAccountModel: vi.fn(async () => ({
    findOne: () => ({
      lean: () => ({
        exec: findOneMock,
      }),
    }),
  })),
}));

vi.mock("../client/create-client-account.js", () => ({
  createClientAccount: vi.fn(),
  normalizeClientEmail: (email: string) => email.trim().toLowerCase(),
}));

import { compare, hash } from "bcryptjs";
import { AccountLockedError, AccountPendingActivationError } from "../../lib/errors.js";
import { verifyClientAccountCredentials } from "./confirm-booking-checkout.js";

describe("verifyClientAccountCredentials — status branching", () => {
  beforeEach(() => {
    findOneMock.mockReset();
  });

  it("throws AccountPendingActivationError for pending_activation (distinct from locked)", async () => {
    findOneMock.mockResolvedValue({
      email: "pending@example.com",
      status: "pending_activation",
      passwordHash: await hash("sentinel-unused", 4),
    });

    await expect(
      verifyClientAccountCredentials("pending@example.com", "any-password"),
    ).rejects.toBeInstanceOf(AccountPendingActivationError);

    await expect(
      verifyClientAccountCredentials("pending@example.com", "any-password"),
    ).rejects.not.toBeInstanceOf(AccountLockedError);
  });

  it("throws AccountLockedError for locked", async () => {
    findOneMock.mockResolvedValue({
      email: "locked@example.com",
      status: "locked",
      passwordHash: await hash("Whatever1!", 4),
    });

    await expect(
      verifyClientAccountCredentials("locked@example.com", "Whatever1!"),
    ).rejects.toBeInstanceOf(AccountLockedError);
  });

  it("returns false for anonymized without throwing pending/locked", async () => {
    findOneMock.mockResolvedValue({
      email: "anon@example.com",
      status: "anonymized",
      passwordHash: await hash("Whatever1!", 4),
    });

    await expect(verifyClientAccountCredentials("anon@example.com", "Whatever1!")).resolves.toBe(
      false,
    );
  });

  it("returns true for active with matching password", async () => {
    const password = "GoodPass1!";
    findOneMock.mockResolvedValue({
      email: "active@example.com",
      status: "active",
      passwordHash: await hash(password, 4),
    });

    await expect(verifyClientAccountCredentials("active@example.com", password)).resolves.toBe(
      true,
    );
    expect(await compare(password, await hash(password, 4))).toBe(true);
  });

  it("returns false when account missing", async () => {
    findOneMock.mockResolvedValue(null);
    await expect(verifyClientAccountCredentials("missing@example.com", "x")).resolves.toBe(false);
  });
});

describe("AccountPendingActivationError", () => {
  it("is a distinct error class from AccountLockedError", () => {
    const pending = new AccountPendingActivationError();
    const locked = new AccountLockedError();
    expect(pending.name).toBe("AccountPendingActivationError");
    expect(locked.name).toBe("AccountLockedError");
    expect(pending).not.toBeInstanceOf(AccountLockedError);
    expect(locked).not.toBeInstanceOf(AccountPendingActivationError);
  });
});
