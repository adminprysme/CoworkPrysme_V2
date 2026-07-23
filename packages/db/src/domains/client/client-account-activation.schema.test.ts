import { describe, expect, it } from "vitest";
import mongoose from "mongoose";

import { registerClientAccountActivationModel } from "./client-account-activation.schema.js";
import {
  CLIENT_ACCOUNT_ACTIVATION_STATUSES,
  CLIENT_ACCOUNT_ACTIVATION_TTL_MS,
} from "../../lib/enums.js";

describe("clientAccountActivations schema", () => {
  it("declares unique tokenHash and partial unique pending clientAccountId", () => {
    const connection = mongoose.createConnection();
    registerClientAccountActivationModel(connection);
    const schema = connection.models.ClientAccountActivation!.schema;
    const indexes = schema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ tokenHash: 1 }, { unique: true }],
        [
          { clientAccountId: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { status: "pending" },
          }),
        ],
        [{ status: 1, expiresAt: 1 }, expect.any(Object)],
      ]),
    );
    void connection.close();
  });

  it("uses pending|consumed|revoked statuses and 7-day default TTL constant", () => {
    expect(CLIENT_ACCOUNT_ACTIVATION_STATUSES).toEqual(["pending", "consumed", "revoked"]);
    expect(CLIENT_ACCOUNT_ACTIVATION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
