import { getAuditLogModel, type StaffProfileDocument } from "@coworkprysme/db";
import type { Types } from "mongoose";

/**
 * Audit trail for staff cardex document mutations.
 * Written to cowork_bdd.auditLogs only (never prysma_bdd).
 */
export async function writeCardexDocumentAudit(input: {
  profile: StaffProfileDocument;
  action: "document.deleted";
  cardexId: Types.ObjectId | string;
  documentId: Types.ObjectId | string;
  category: string;
  label?: string;
  originalFilename: string;
  uploadedByStaffProfileId: Types.ObjectId | string;
  at?: Date;
}): Promise<{ auditId: string }> {
  const AuditLog = await getAuditLogModel();
  const created = await AuditLog.create({
    actor: { kind: "staff", id: input.profile._id },
    action: input.action,
    entity: { type: "cardexDocument", id: input.documentId },
    diff: {
      cardexId: { before: String(input.cardexId), after: null },
      category: { before: input.category, after: null },
      label: { before: input.label ?? null, after: null },
      originalFilename: { before: input.originalFilename, after: null },
      uploadedByStaffProfileId: { before: String(input.uploadedByStaffProfileId), after: null },
      deletedByStaffProfileId: { before: null, after: String(input.profile._id) },
    },
    at: input.at ?? new Date(),
  });
  return { auditId: String(created._id) };
}
