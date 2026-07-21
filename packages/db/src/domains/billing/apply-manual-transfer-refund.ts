import type { ClientSession, Types } from "mongoose";

import { connectMongo, getCoworkDb } from "../../connection.js";
import { InvoiceNotFoundError } from "../../lib/errors.js";
import { assertReplicaSetForTransactions } from "../../lib/replica-set.js";
import { getInvoiceModel, type InvoiceDocument } from "./invoice.schema.js";
import { computePaymentRefundCaps } from "./payment-refund-caps.js";
import { getPaymentModel, type PaymentDocument } from "./payment.schema.js";

export interface ApplyManualTransferRefundInput {
  invoiceId: Types.ObjectId | string;
  /** Refund amount in integer cents. */
  amountCents: number;
  /** Unique idempotency key (e.g. gestion-manual-refund:{reservationId}:{auditId}). */
  idempotencyKey: string;
  /** Staff note required for audit / cardex trail. */
  manualNote: string;
  receivedAt?: Date;
}

export interface ApplyManualTransferRefundResult {
  /** false when this idempotency key was already applied. */
  applied: boolean;
  invoice: InvoiceDocument;
  payment: PaymentDocument;
}

/**
 * Apply a staff-confirmed off-Stripe bank-transfer refund.
 * Adjusts paidTotal / balanceDue / status only — never invoice.type or line items.
 */
export async function applyManualTransferRefund(
  input: ApplyManualTransferRefundInput,
): Promise<ApplyManualTransferRefundResult> {
  const idempotencyKey = input.idempotencyKey.trim();
  const manualNote = input.manualNote.trim();
  if (!idempotencyKey) {
    throw new Error("idempotencyKey is required");
  }
  if (manualNote.length < 3) {
    throw new Error("manualNote must be at least 3 characters");
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("amountCents must be a positive integer (cents)");
  }

  await connectMongo();
  const connection = await getCoworkDb();
  await assertReplicaSetForTransactions(connection);

  const Invoice = await getInvoiceModel();
  const Payment = await getPaymentModel();
  const receivedAt = input.receivedAt ?? new Date();

  const session = await connection.startSession();
  try {
    let result: ApplyManualTransferRefundResult | undefined;

    await session.withTransaction(async () => {
      result = await applyManualTransferRefundInSession(
        { ...input, idempotencyKey, manualNote, receivedAt },
        { Invoice, Payment, session },
      );
    });

    if (!result) {
      throw new Error("applyManualTransferRefund transaction produced no result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}

async function applyManualTransferRefundInSession(
  input: ApplyManualTransferRefundInput & {
    receivedAt: Date;
    idempotencyKey: string;
    manualNote: string;
  },
  deps: {
    Invoice: Awaited<ReturnType<typeof getInvoiceModel>>;
    Payment: Awaited<ReturnType<typeof getPaymentModel>>;
    session: ClientSession;
  },
): Promise<ApplyManualTransferRefundResult> {
  const existing = await deps.Payment.findOne({
    "reconciliation.idempotencyKey": input.idempotencyKey,
  })
    .session(deps.session)
    .exec();

  if (existing) {
    const invoice = await deps.Invoice.findById(existing.invoiceId).session(deps.session).exec();
    if (!invoice) {
      throw new InvoiceNotFoundError();
    }
    return { applied: false, invoice, payment: existing };
  }

  const invoice = await deps.Invoice.findById(input.invoiceId).session(deps.session).exec();
  if (!invoice) {
    throw new InvoiceNotFoundError();
  }

  const payments = await deps.Payment.find({ invoiceId: invoice._id })
    .session(deps.session)
    .lean()
    .exec();
  const caps = computePaymentRefundCaps(payments);
  if (input.amountCents > caps.transferRefundableCents) {
    throw new Error(
      `REFUND_EXCEEDS_TRANSFER_PAID: amount=${input.amountCents} refundable=${caps.transferRefundableCents}`,
    );
  }

  const invoiceType = invoice.type;
  const nextPaidTotal = Math.max(0, invoice.totals.paidTotal - input.amountCents);
  const nextBalanceDue = Math.max(0, invoice.totals.ttc - nextPaidTotal);
  const nextStatus =
    nextPaidTotal <= 0
      ? ("proforma" as const)
      : nextBalanceDue === 0
        ? ("paid" as const)
        : ("partially_paid" as const);

  const created = await deps.Payment.create(
    [
      {
        currency: invoice.currency,
        invoiceId: invoice._id,
        cardexId: invoice.cardexId,
        kind: "refund",
        method: "transfer",
        amount: input.amountCents,
        reconciliation: {
          status: "matched",
          idempotencyKey: input.idempotencyKey,
          manualNote: input.manualNote,
        },
        receivedAt: input.receivedAt,
      },
    ],
    { session: deps.session },
  );
  const payment = created[0];
  if (!payment) {
    throw new Error("Failed to create manual transfer refund payment");
  }

  invoice.totals.paidTotal = nextPaidTotal;
  invoice.totals.balanceDue = nextBalanceDue;
  invoice.status = nextStatus;
  invoice.type = invoiceType;
  if (nextPaidTotal <= 0) {
    invoice.paidAt = undefined;
  }
  await invoice.save({ session: deps.session });

  return { applied: true, invoice, payment };
}
