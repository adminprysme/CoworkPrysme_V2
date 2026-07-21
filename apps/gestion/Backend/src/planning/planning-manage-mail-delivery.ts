import type { Types } from "mongoose";
import type { StaffProfileDocument } from "@coworkprysme/db";

import {
  emailDeliveryAuditDiff,
  mailDeliveryFromResult,
  type SendMailResult,
} from "../mail/mail.service.js";
import { writePlanningManageAudit, type PlanningAuditDiff } from "./planning-manage-audit.js";

export async function writeStaffEmailDeliveryAudit(input: {
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
  spaceId: string;
  mailResult: SendMailResult;
  extraDiff?: PlanningAuditDiff;
  reason?: string;
}): Promise<void> {
  const outcome = mailDeliveryFromResult(input.mailResult);
  await writePlanningManageAudit({
    profile: input.profile,
    action: input.action,
    reservationId: input.reservationId,
    reason: input.reason,
    diff: {
      spaceId: { before: input.spaceId, after: input.spaceId },
      ...emailDeliveryAuditDiff(outcome),
      ...(input.extraDiff ?? {}),
    },
  });
}
