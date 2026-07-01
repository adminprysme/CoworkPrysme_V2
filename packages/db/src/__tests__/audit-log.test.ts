import { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connectMongo } from "../connection.js";
import { registerAuditLogModel } from "../domains/staff/audit-log.schema.js";
import {
  configureIntegrationEnv,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./integration/setup.js";

describe("auditLogs immutability", () => {
  beforeAll(async () => {
    const uri = await startIntegrationMongo();
    await configureIntegrationEnv(uri);
    await connectMongo();
  }, 120_000);

  afterAll(async () => {
    await stopIntegrationMongo();
  });

  it("blocks save on an existing document", async () => {
    const { getCoworkDb } = await import("../connection.js");
    const connection = await getCoworkDb();
    const AuditLog = registerAuditLogModel(connection);

    const doc = await AuditLog.create({
      actor: { kind: "system", id: "system" },
      action: "test.action",
      entity: { type: "test", id: new Types.ObjectId() },
      at: new Date(),
    });

    doc.action = "test.action.modified";
    await expect(doc.save()).rejects.toThrow(/immutable/i);
  });

  it("blocks updateOne mutations", async () => {
    const { getCoworkDb } = await import("../connection.js");
    const connection = await getCoworkDb();
    const AuditLog = registerAuditLogModel(connection);

    await expect(AuditLog.updateOne({}, { action: "modified" })).rejects.toThrow(/immutable/i);
  });
});
