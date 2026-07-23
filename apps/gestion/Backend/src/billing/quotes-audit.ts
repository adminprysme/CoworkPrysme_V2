import { getAuditLogModel, type StaffProfileDocument } from "@coworkprysme/db";
import type { Types } from "mongoose";

/**
 * Audit trail for staff quote mutations (cowork_bdd.auditLogs only).
 */
export async function writeQuoteAudit(input: {
  profile: StaffProfileDocument;
  action: "quote.deleted" | "quote.sent" | "quote.refused" | "quote.expired";
  quoteId: Types.ObjectId | string;
  reference?: string;
  statusBefore?: string;
  statusAfter?: string | null;
  at?: Date;
}): Promise<{ auditId: string }> {
  const AuditLog = await getAuditLogModel();
  const created = await AuditLog.create({
    actor: { kind: "staff", id: input.profile._id },
    action: input.action,
    entity: { type: "quote", id: input.quoteId },
    diff: {
      ...(input.reference
        ? { reference: { before: input.reference, after: input.reference } }
        : {}),
      ...(input.statusBefore !== undefined
        ? {
            status: {
              before: input.statusBefore,
              after: input.statusAfter ?? null,
            },
          }
        : {}),
    },
    at: input.at ?? new Date(),
  });
  return { auditId: String(created._id) };
}
