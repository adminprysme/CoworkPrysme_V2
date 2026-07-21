import { getAuditLogModel, type StaffProfileDocument } from "@coworkprysme/db";
import type { Types } from "mongoose";

export interface PlanningAuditDiff {
  [field: string]: { before: unknown; after: unknown };
}

/**
 * Immutable audit trail for Planning Wave 2 staff actions (§4.2 CDC).
 * Written to cowork_bdd.auditLogs only (never prysma_bdd).
 */
export async function writePlanningManageAudit(input: {
  profile: StaffProfileDocument;
  action:
    | "reservation.space_change"
    | "reservation.cancel"
    | "reservation.restore"
    | "reservation.date_change"
    | "reservation.party_size_change"
    | "reservation.contact_transfer"
    | "reservation.refund";
  reservationId: Types.ObjectId | string;
  diff?: PlanningAuditDiff;
  reason?: string;
  at?: Date;
}): Promise<{ auditId: string }> {
  const AuditLog = await getAuditLogModel();
  const created = await AuditLog.create({
    actor: { kind: "staff", id: input.profile._id },
    action: input.action,
    entity: { type: "reservation", id: input.reservationId },
    diff: input.diff,
    reason: input.reason,
    at: input.at ?? new Date(),
  });
  return { auditId: String(created._id) };
}
