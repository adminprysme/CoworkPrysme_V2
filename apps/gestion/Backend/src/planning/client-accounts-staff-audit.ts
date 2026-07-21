import { getAuditLogModel, type StaffProfileDocument } from "@coworkprysme/db";
import type { Types } from "mongoose";

export interface ClientStaffAuditDiff {
  [field: string]: { before: unknown; after: unknown };
}

/**
 * Audit trail for staff ClientAccount / cardex ownership actions.
 * Written to cowork_bdd.auditLogs only (never prysma_bdd).
 */
export async function writeClientStaffAudit(input: {
  profile: StaffProfileDocument;
  action: "client.account.lock" | "client.account.unlock" | "client.account.transfer_ownership";
  entity: { type: "clientAccount" | "cardex"; id: Types.ObjectId | string };
  diff?: ClientStaffAuditDiff;
  reason?: string;
  at?: Date;
}): Promise<{ auditId: string }> {
  const AuditLog = await getAuditLogModel();
  const created = await AuditLog.create({
    actor: { kind: "staff", id: input.profile._id },
    action: input.action,
    entity: { type: input.entity.type, id: input.entity.id },
    diff: input.diff,
    reason: input.reason,
    at: input.at ?? new Date(),
  });
  return { auditId: String(created._id) };
}
