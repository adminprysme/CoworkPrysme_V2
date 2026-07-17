import type { ClientSession, Types } from "mongoose";

import { connectMongo, getCoworkDb } from "../../connection.js";
import { InvoiceNotFoundError } from "../../lib/errors.js";
import { assertReplicaSetForTransactions } from "../../lib/replica-set.js";
import { getInvoiceModel, type InvoiceDocument } from "./invoice.schema.js";
import { getPaymentModel, type PaymentDocument } from "./payment.schema.js";
import { getQontoTransferCandidateModel } from "./qonto-transfer-candidate.schema.js";

export interface ApplyBankTransferPaymentInput {
  invoiceId: Types.ObjectId | string;
  /** Amount received in cents — typically the full balanceDue. */
  amountReceived: number;
  receivedAt?: Date;
  /** Optional staff note / operator id for audit. */
  markedByStaffProfileId?: Types.ObjectId | string;
  /**
   * Optional Qonto transaction id when confirming a suggested match.
   * Written to Payment.reconciliation.qontoTxId (unique sparse index).
   */
  qontoTxId?: string;
}

export interface ApplyBankTransferPaymentResult {
  /** false when invoice was already fully paid (idempotent). */
  applied: boolean;
  invoice: InvoiceDocument;
  payment: PaymentDocument | null;
}

/**
 * Apply a manual bank-transfer payment to a proforma invoice.
 * Never changes invoice.type (stays "proforma").
 */
export async function applyBankTransferPayment(
  input: ApplyBankTransferPaymentInput,
): Promise<ApplyBankTransferPaymentResult> {
  if (!Number.isInteger(input.amountReceived) || input.amountReceived <= 0) {
    throw new Error("amountReceived must be a positive integer (cents)");
  }

  const qontoTxId = input.qontoTxId?.trim() || undefined;

  await connectMongo();
  const connection = await getCoworkDb();
  await assertReplicaSetForTransactions(connection);

  const Invoice = await getInvoiceModel();
  const Payment = await getPaymentModel();
  const QontoCandidate = await getQontoTransferCandidateModel();
  const receivedAt = input.receivedAt ?? new Date();

  const session = await connection.startSession();
  try {
    let result: ApplyBankTransferPaymentResult | undefined;

    await session.withTransaction(async () => {
      result = await applyBankTransferPaymentInSession(
        { ...input, receivedAt, qontoTxId },
        { Invoice, Payment, QontoCandidate, session },
      );
    });

    if (!result) {
      throw new Error("applyBankTransferPayment transaction produced no result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}

async function applyBankTransferPaymentInSession(
  input: ApplyBankTransferPaymentInput & { receivedAt: Date; qontoTxId?: string },
  deps: {
    Invoice: Awaited<ReturnType<typeof getInvoiceModel>>;
    Payment: Awaited<ReturnType<typeof getPaymentModel>>;
    QontoCandidate: Awaited<ReturnType<typeof getQontoTransferCandidateModel>>;
    session: ClientSession;
  },
): Promise<ApplyBankTransferPaymentResult> {
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

  const invoiceType = invoice.type;
  const nextPaidTotal = invoice.totals.paidTotal + input.amountReceived;
  const nextBalanceDue = Math.max(0, invoice.totals.ttc - nextPaidTotal);
  const nextStatus = nextBalanceDue === 0 ? "paid" : "partially_paid";
  const kind =
    nextBalanceDue === 0 && invoice.totals.paidTotal === 0 ? "full" : ("balance" as const);

  const created = await deps.Payment.create(
    [
      {
        currency: invoice.currency,
        invoiceId: invoice._id,
        cardexId: invoice.cardexId,
        kind,
        method: "transfer",
        amount: input.amountReceived,
        reconciliation: {
          status: "matched",
          ...(input.qontoTxId ? { qontoTxId: input.qontoTxId } : {}),
        },
        receivedAt: input.receivedAt,
      },
    ],
    { session: deps.session },
  );
  const payment = created[0];
  if (!payment) {
    throw new Error("Failed to create transfer payment");
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
