import { describe, expect, it } from "vitest";

import {
  StaffQuoteAvailabilityCheckRequestSchema,
  StaffQuoteLocksAcquireRequestSchema,
  StaffQuoteLocksSessionRequestSchema,
} from "./billing-quote-locks.js";

describe("billing-quote-locks schemas", () => {
  const slot = {
    spaceId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    startAt: "2026-08-01T10:00:00.000Z",
    endAt: "2026-08-01T11:00:00.000Z",
  };

  it("accepts multi-slot acquire with quoteDraftId", () => {
    const parsed = StaffQuoteLocksAcquireRequestSchema.parse({
      quoteDraftId: "bbbbbbbbbbbbbbbbbbbbbbbb",
      slots: [slot, { ...slot, spaceId: "cccccccccccccccccccccccc" }],
    });
    expect(parsed.slots).toHaveLength(2);
  });

  it("rejects endAt <= startAt", () => {
    const result = StaffQuoteAvailabilityCheckRequestSchema.safeParse({
      slots: [{ ...slot, endAt: slot.startAt }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts refresh/release session body", () => {
    expect(
      StaffQuoteLocksSessionRequestSchema.parse({ quoteDraftId: "bbbbbbbbbbbbbbbbbbbbbbbb" })
        .quoteDraftId,
    ).toBe("bbbbbbbbbbbbbbbbbbbbbbbb");
  });
});
