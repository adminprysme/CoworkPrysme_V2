import type { Types } from "mongoose";

import { applyStaffPayment, type ApplyStaffPaymentResult } from "./apply-staff-payment.js";

export interface ApplyBankTransferPaymentInput {
  invoiceId: Types.ObjectId | string;
  /** Amount received in cents — typically the full balanceDue. */
  amountReceived: number;
  receivedAt?: Date;
  /** Optional staff operator id — persisted on Payment.markedByStaffProfileId. */
  markedByStaffProfileId?: Types.ObjectId | string;
  /**
   * Optional Qonto transaction id when confirming a suggested match.
   * Written to Payment.reconciliation.qontoTxId (unique sparse index).
   */
  qontoTxId?: string;
}

export type ApplyBankTransferPaymentResult = ApplyStaffPaymentResult;

/**
 * Apply a manual bank-transfer payment to a proforma invoice.
 * Delegates settlement math to {@link applyStaffPayment} (method: transfer).
 * Never changes invoice.type (stays "proforma").
 */
export async function applyBankTransferPayment(
  input: ApplyBankTransferPaymentInput,
): Promise<ApplyBankTransferPaymentResult> {
  return applyStaffPayment({
    ...input,
    method: "transfer",
  });
}
