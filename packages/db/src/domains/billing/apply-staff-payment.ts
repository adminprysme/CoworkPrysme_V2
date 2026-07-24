import type { ClientSession, Types } from "mongoose";

import { connectMongo, getCoworkDb } from "../../connection.js";
import type { PaymentMethod } from "../../lib/enums.js";
import { InvoiceNotFoundError, PaymentAmountExceedsBalanceError } from "../../lib/errors.js";
import { assertReplicaSetForTransactions } from "../../lib/replica-set.js";
import { getInvoiceModel, type InvoiceDocument } from "./invoice.schema.js";
import { getPaymentModel, type PaymentDocument } from "./payment.schema.js";
import { getQontoTransferCandidateModel } from "./qonto-transfer-candidate.schema.js";

/** Staff-applied payment methods that share the balance/status settlement core. */
export type StaffAppliedPaymentMethod = Extract<PaymentMethod, "transfer" | "manual">;

export interface ApplyStaffPaymentInput {
  invoiceId: Types.ObjectId | string;
  /** Amount received in integer cents (partial or full). */
  amountReceived: number;
  method: StaffAppliedPaymentMethod;
  receivedAt?: Date;
  /** Staff operator who recorded the payment (persisted on Payment). */
  markedByStaffProfileId?: Types.ObjectId | string;
  /** Optional staff note (stored on reconciliation.manualNote). */
  manualNote?: string;
  /**
   * Optional Qonto transaction id when confirming a suggested match (transfer only).
   * Written to Payment.reconciliation.qontoTxId (unique sparse index).
   */
  qontoTxId?: string;
}

export interface ApplyStaffPaymentResult {
  /** false when invoice was already fully paid, or Qonto tx already applied. */
  applied: boolean;
  invoice: InvoiceDocument;
  payment: PaymentDocument | null;
}

/**
 * Apply a staff payment (bank transfer or generic manual) to an invoice.
 * Updates paidTotal / balanceDue / status only — never changes invoice.type.
 * Rejects amountReceived that would exceed the remaining balanceDue.
 */
export async function applyStaffPayment(
  input: ApplyStaffPaymentInput,
): Promise<ApplyStaffPaymentResult> {
  if (!Number.isInteger(input.amountReceived) || input.amountReceived <= 0) {
    throw new Error("amountReceived must be a positive integer (cents)");
  }
  if (input.method !== "transfer" && input.method !== "manual") {
    throw new Error(`Unsupported staff payment method: ${String(input.method)}`);
  }

  const qontoTxId = input.qontoTxId?.trim() || undefined;
  if (qontoTxId && input.method !== "transfer") {
    throw new Error("qontoTxId is only supported for transfer payments");
  }

  const manualNote = input.manualNote?.trim() || undefined;

  await connectMongo();
  const connection = await getCoworkDb();
  await assertReplicaSetForTransactions(connection);

  const Invoice = await getInvoiceModel();
  const Payment = await getPaymentModel();
  const QontoCandidate = await getQontoTransferCandidateModel();
  const receivedAt = input.receivedAt ?? new Date();

  const session = await connection.startSession();
  try {
    let result: ApplyStaffPaymentResult | undefined;

    await session.withTransaction(async () => {
      result = await applyStaffPaymentInSession(
        {
          ...input,
          receivedAt,
          qontoTxId,
          manualNote,
        },
        { Invoice, Payment, QontoCandidate, session },
      );
    });

    if (!result) {
      throw new Error("applyStaffPayment transaction produced no result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}

async function applyStaffPaymentInSession(
  input: ApplyStaffPaymentInput & {
    receivedAt: Date;
    qontoTxId?: string;
    manualNote?: string;
  },
  deps: {
    Invoice: Awaited<ReturnType<typeof getInvoiceModel>>;
    Payment: Awaited<ReturnType<typeof getPaymentModel>>;
    QontoCandidate: Awaited<ReturnType<typeof getQontoTransferCandidateModel>>;
    session: ClientSession;
  },
): Promise<ApplyStaffPaymentResult> {
  if (input.qontoTxId) {
    const existingByQonto = await deps.Payment.findOne({
      "reconciliation.qontoTxId": input.qontoTxId,
    })
      .session(deps.session)
      .exec();
    if (existingByQonto) {
      const invoice = await deps.Invoice.findById(existingByQonto.invoiceId)
        .session(deps.session)
        .exec();
      if (!invoice) {
        throw new InvoiceNotFoundError();
      }
      return { applied: false, invoice, payment: existingByQonto };
    }
  }

  const invoice = await deps.Invoice.findById(input.invoiceId).session(deps.session).exec();
  if (!invoice) {
    throw new InvoiceNotFoundError();
  }

  if (invoice.totals.balanceDue <= 0 || invoice.status === "paid") {
    return { applied: false, invoice, payment: null };
  }

  if (input.amountReceived > invoice.totals.balanceDue) {
    throw new PaymentAmountExceedsBalanceError(input.amountReceived, invoice.totals.balanceDue);
  }

  const invoiceType = invoice.type;
  const nextPaidTotal = invoice.totals.paidTotal + input.amountReceived;
  const nextBalanceDue = Math.max(0, invoice.totals.ttc - nextPaidTotal);
  const nextStatus = nextBalanceDue === 0 ? "paid" : "partially_paid";
  const kind =
    nextBalanceDue === 0 && invoice.totals.paidTotal === 0 ? "full" : ("balance" as const);

  const markedBy =
    input.markedByStaffProfileId != null && String(input.markedByStaffProfileId).trim() !== ""
      ? input.markedByStaffProfileId
      : undefined;

  const created = await deps.Payment.create(
    [
      {
        currency: invoice.currency,
        invoiceId: invoice._id,
        cardexId: invoice.cardexId,
        kind,
        method: input.method,
        amount: input.amountReceived,
        ...(markedBy ? { markedByStaffProfileId: markedBy } : {}),
        reconciliation: {
          status: "matched",
          ...(input.qontoTxId ? { qontoTxId: input.qontoTxId } : {}),
          ...(input.manualNote ? { manualNote: input.manualNote } : {}),
        },
        receivedAt: input.receivedAt,
      },
    ],
    { session: deps.session },
  );
  const payment = created[0];
  if (!payment) {
    throw new Error("Failed to create staff payment");
  }

  invoice.totals.paidTotal = nextPaidTotal;
  invoice.totals.balanceDue = nextBalanceDue;
  invoice.status = nextStatus;
  invoice.type = invoiceType;
  if (nextBalanceDue === 0) {
    invoice.paidAt = input.receivedAt;
  }
  await invoice.save({ session: deps.session });

  if (input.qontoTxId) {
    await deps.QontoCandidate.updateOne(
      { qontoTxId: input.qontoTxId },
      { $set: { consumedAt: input.receivedAt } },
      { session: deps.session },
    ).exec();
  }

  return { applied: true, invoice, payment };
}
