import { describe, expect, it } from "vitest";

import {
  CLIENT_ACCOUNT_AUTH_ERROR_CODES,
  CLIENT_ACCOUNT_LOCKED_USER_MESSAGE,
  CLIENT_ACCOUNT_PENDING_ACTIVATION_USER_MESSAGE,
  CLIENT_ACCOUNT_STAFF_ERROR_CODES,
  ClientAccountStatusSchema,
  StaffDeactivateClientAccountRequestSchema,
  StaffTransferCardexOwnershipRequestSchema,
} from "./client-account-staff.js";

describe("client-account-staff schemas", () => {
  it("allows deactivate without reason", () => {
    expect(StaffDeactivateClientAccountRequestSchema.parse({})).toEqual({});
  });

  it("trims and accepts optional reason", () => {
    expect(
      StaffDeactivateClientAccountRequestSchema.parse({ reason: "  départ collaborateur  " }),
    ).toEqual({ reason: "départ collaborateur" });
  });

  it("requires nextClientAccountId for ownership transfer", () => {
    expect(() => StaffTransferCardexOwnershipRequestSchema.parse({})).toThrow();
    expect(
      StaffTransferCardexOwnershipRequestSchema.parse({
        nextClientAccountId: "6a5f3efeebd0da8b88b67bc4",
      }),
    ).toEqual({ nextClientAccountId: "6a5f3efeebd0da8b88b67bc4" });
  });

  it("includes pending_activation in ClientAccount status enum", () => {
    expect(ClientAccountStatusSchema.options).toEqual([
      "active",
      "locked",
      "anonymized",
      "pending_activation",
    ]);
  });

  it("exports locked user message and staff error codes", () => {
    expect(CLIENT_ACCOUNT_LOCKED_USER_MESSAGE).toContain("désactivé");
    expect(CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_IS_OWNER).toBe("ACCOUNT_IS_OWNER");
    expect(CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_LAST_ACTIVE).toBe("ACCOUNT_LAST_ACTIVE");
  });

  it("exports distinct pending_activation auth code and message", () => {
    expect(CLIENT_ACCOUNT_AUTH_ERROR_CODES.ACCOUNT_PENDING_ACTIVATION).toBe(
      "ACCOUNT_PENDING_ACTIVATION",
    );
    expect(CLIENT_ACCOUNT_AUTH_ERROR_CODES.ACCOUNT_LOCKED).toBe("ACCOUNT_LOCKED");
    expect(CLIENT_ACCOUNT_PENDING_ACTIVATION_USER_MESSAGE).toContain("pas encore activé");
    expect(CLIENT_ACCOUNT_PENDING_ACTIVATION_USER_MESSAGE).not.toBe(
      CLIENT_ACCOUNT_LOCKED_USER_MESSAGE,
    );
  });

  it("exposes canonical staff error messages", async () => {
    const { CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES } = await import("./client-account-staff.js");
    expect(CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_IS_OWNER).toContain("Transférez");
    expect(CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_LAST_ACTIVE).toContain("dernier compte");
  });
});
