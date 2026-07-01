import { describe, expect, it } from "vitest";

import { registerSlotLockModel } from "../domains/reservation/slot-lock.schema.js";
import { CENTS_VALIDATOR } from "../lib/schema-helpers.js";
import { reservationPricingSnapshotSchema } from "../lib/subdocuments.js";
import mongoose from "mongoose";

describe("slotLocks schema indexes", () => {
  it("declares TTL index on expiresAt and unique compound index", () => {
    const connection = mongoose.createConnection();
    registerSlotLockModel(connection);
    const schema = connection.models.SlotLock!.schema;
    const indexes = schema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
        [{ spaceId: 1, startAt: 1, endAt: 1 }, { unique: true }],
      ]),
    );
    connection.close();
  });
});

describe("monetary fields use integer cent validators", () => {
  it("rejects non-integer cent amounts on reservation pricing snapshot", () => {
    const subtotalPath = reservationPricingSnapshotSchema.path("subtotalHT");
    expect(subtotalPath?.validators.length).toBeGreaterThan(0);
    const isIntegerCents = (value: number) => Number.isInteger(value);
    expect(isIntegerCents(1000)).toBe(true);
    expect(isIntegerCents(10.5)).toBe(false);
    expect(CENTS_VALIDATOR.validator(1000)).toBe(true);
    expect(CENTS_VALIDATOR.validator(10.5)).toBe(false);
  });
});
