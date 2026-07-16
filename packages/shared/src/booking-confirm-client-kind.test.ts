import { describe, expect, it } from "vitest";

import { BookingConfirmRequestSchema } from "./booking-confirm.js";

const base = {
  lockId: "507f1f77bcf86cd799439011",
  sessionId: "session-abcdefgh",
  spaceId: "507f1f77bcf86cd799439012",
  startAt: "2026-08-01T10:00:00.000Z",
  endAt: "2026-08-01T11:00:00.000Z",
  durationClass: "hourly" as const,
  partySize: 2,
  services: [],
  accountMode: "new" as const,
  email: "client@example.com",
  password: "SecretPass1!",
  identity: { firstName: "Ada", lastName: "Lovelace" },
  privacyPolicyAccepted: true,
  cgvAccepted: true as const,
  withdrawalAcknowledged: true as const,
  paymentMethod: "proforma" as const,
};

describe("BookingConfirmRequestSchema — clientKind", () => {
  it("accepts individual with address", () => {
    const parsed = BookingConfirmRequestSchema.parse({
      ...base,
      clientKind: "individual",
      address: { street: "10 rue X", zip: "69001", city: "Lyon" },
    });
    expect(parsed.clientKind).toBe("individual");
    expect(parsed.address?.country).toBe("FR");
  });

  it("rejects individual without address", () => {
    const result = BookingConfirmRequestSchema.safeParse({
      ...base,
      clientKind: "individual",
    });
    expect(result.success).toBe(false);
  });

  it("accepts company with billing address and optional siret", () => {
    const parsed = BookingConfirmRequestSchema.parse({
      ...base,
      clientKind: "company",
      company: {
        legalName: "ACME SAS",
        siret: "12345678901234",
        vatNumber: "FR32 123456789",
        billingAddress: { street: "1 place Y", zip: "69002", city: "Lyon" },
      },
    });
    expect(parsed.company?.siret).toBe("12345678901234");
    expect(parsed.company?.vatNumber).toBe("FR32123456789");
  });

  it("rejects company with invalid siret length", () => {
    const result = BookingConfirmRequestSchema.safeParse({
      ...base,
      clientKind: "company",
      company: {
        legalName: "ACME SAS",
        siret: "123",
        billingAddress: { street: "1 place Y", zip: "69002", city: "Lyon" },
      },
    });
    expect(result.success).toBe(false);
  });
});
