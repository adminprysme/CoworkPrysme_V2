import { getAuditLogModel } from "@coworkprysme/db";
import { Types, type Types as MongooseTypes } from "mongoose";

import {
  emailDeliveryAuditDiff,
  mailDeliveryFromResult,
  type SendMailResult,
} from "../mail/mail.service.js";

export type BookingEmailAction =
  | "booking.email.card_confirmation"
  | "booking.email.account_created"
  | "booking.email.bank_transfer_instructions"
  | "booking.email.bank_transfer_reminder"
  | "booking.email.bank_transfer_expired"
  | "booking.email.staff_notification";

/**
 * Immutable audit for vitrine transactional emails (honest emailSent).
 * Actor is system/vitrine-api — no staff session on this path.
 */
export async function writeBookingEmailDeliveryAudit(input: {
  action: BookingEmailAction;
  reservationId?: MongooseTypes.ObjectId | string;
  reservationReference?: string;
  invoiceReference?: string;
  mailResult: SendMailResult;
  /** Whether a PDF was attached (false when soft-fail / not applicable). */
  pdfAttached?: boolean;
  to?: string;
}): Promise<void> {
  if (!input.reservationId) {
    return;
  }

  const outcome = mailDeliveryFromResult(input.mailResult);
  const AuditLog = await getAuditLogModel();
  const entityId =
    input.reservationId instanceof Types.ObjectId
      ? input.reservationId
      : new Types.ObjectId(String(input.reservationId));

  await AuditLog.create({
    actor: { kind: "system", id: "vitrine-api" },
    action: input.action,
    entity: { type: "reservation", id: entityId },
    diff: {
      ...emailDeliveryAuditDiff(outcome),
      ...(typeof input.pdfAttached === "boolean"
        ? { emailPdfAttached: { before: null, after: input.pdfAttached } }
        : {}),
      ...(input.reservationReference
        ? { reservationReference: { before: null, after: input.reservationReference } }
        : {}),
      ...(input.invoiceReference
        ? { invoiceReference: { before: null, after: input.invoiceReference } }
        : {}),
      ...(input.to ? { emailTo: { before: null, after: input.to } } : {}),
      ...(input.mailResult.messageId
        ? { emailMessageId: { before: null, after: input.mailResult.messageId } }
        : {}),
    },
    at: new Date(),
  });
}
