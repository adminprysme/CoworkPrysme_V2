import type { ClientSession, Types } from "mongoose";

import { connectMongo, getCoworkDb } from "../../connection.js";
import { InvoiceNotFoundError } from "../../lib/errors.js";
import { assertReplicaSetForTransactions } from "../../lib/replica-set.js";
import { getInvoiceModel, type InvoiceDocument } from "./invoice.schema.js";
import { computePaymentRefundCaps } from "./payment-refund-caps.js";
import { getPaymentModel, type PaymentDocument } from "./payment.schema.js";

export interface ApplyStripeCardRefundInput {
  invoiceId: Types.ObjectId | string;
  /** Stripe Refund id (`re_…`). */
  stripeRefundId: string;
  /** Original PaymentIntent id (`pi_…`). */
  stripePaymentIntentId: string;
  /** Refund amount in integer cents (from Stripe, never from the client). */
  amountCents: number;
  /** Idempotency key used when creating the refund (optional on webhook-only path). */
  idempotencyKey?: string;
  receivedAt?: Date;
}

export interface ApplyStripeCardRefundResult {
  /** false when this stripeRefundId was already applied (idempotent replay). */
  applied: boolean;
  invoice: InvoiceDocument;
  payment: PaymentDocument;
}

/**
 * Confirm a Stripe card refund against a proforma invoice.
 * Idempotent on stripeRefundId. Never changes invoice.type or line items.
 */
export async function applyStripeCardRefund(
  input: ApplyStripeCardRefundInput,
): Promise<ApplyStripeCardRefundResult> {
  const stripeRefundId = input.stripeRefundId.trim();
  const stripePaymentIntentId = input.stripePaymentIntentId.trim();
  if (!stripeRefundId) {
    throw new Error("stripeRefundId is required");
  }
  if (!stripePaymentIntentId) {
    throw new Error("stripePaymentIntentId is required");
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
  const idempotencyKey = input.idempotencyKey?.trim() || undefined;

  const session = await connection.startSession();
  try {
    let result: ApplyStripeCardRefundResult | undefined;

    await session.withTransaction(async () => {
      result = await applyStripeCardRefundInSession(
        {
          ...input,
          stripeRefundId,
          stripePaymentIntentId,
          receivedAt,
          idempotencyKey,
        },
        { Invoice, Payment, session },
      );
    });

    if (!result) {
      throw new Error("applyStripeCardRefund transaction produced no result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Promote an existing pending refund Payment to matched and adjust invoice totals.
 * Used when gestion created a pending row before Stripe confirmed.
 */
export async function confirmPendingStripeCardRefund(input: {
  stripeRefundId: string;
  amountCents: number;
  receivedAt?: Date;
}): Promise<ApplyStripeCardRefundResult> {
  const stripeRefundId = input.stripeRefundId.trim();
  if (!stripeRefundId) {
    throw new Error("stripeRefundId is required");
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
    let result: ApplyStripeCardRefundResult | undefined;

    await session.withTransaction(async () => {
      const existing = await Payment.findOne({
        "reconciliation.stripeRefundId": stripeRefundId,
      })
        .session(session)
        .exec();

      if (!existing) {
        throw new Error(`Pending refund payment not found for ${stripeRefundId}`);
      }

      const invoice = await Invoice.findById(existing.invoiceId).session(session).exec();
      if (!invoice) {
        throw new InvoiceNotFoundError();
      }

      if (existing.reconciliation.status === "matched") {
        result = { applied: false, invoice, payment: existing };
        return;
      }

      if (existing.kind !== "refund" || existing.method !== "card") {
        throw new Error("Payment is not a card refund");
      }
      if (existing.amount !== input.amountCents) {
        throw new Error(
          `Refund amount mismatch payment=${existing.amount} stripe=${input.amountCents}`,
        );
      }

      const invoiceType = invoice.type;
      const nextPaidTotal = Math.max(0, invoice.totals.paidTotal - existing.amount);
      const nextBalanceDue = Math.max(0, invoice.totals.ttc - nextPaidTotal);
      const nextStatus =
        nextPaidTotal <= 0
          ? ("proforma" as const)
          : nextBalanceDue === 0
            ? ("paid" as const)
            : ("partially_paid" as const);

      existing.reconciliation.status = "matched";
      existing.receivedAt = receivedAt;
      await existing.save({ session });

      invoice.totals.paidTotal = nextPaidTotal;
      invoice.totals.balanceDue = nextBalanceDue;
      invoice.status = nextStatus;
      invoice.type = invoiceType;
      if (nextPaidTotal <= 0) {
        invoice.paidAt = undefined;
      }
      await invoice.save({ session });

      result = { applied: true, invoice, payment: existing };
    });

    if (!result) {
      throw new Error("confirmPendingStripeCardRefund transaction produced no result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}

async function applyStripeCardRefundInSession(
  input: ApplyStripeCardRefundInput & {
    receivedAt: Date;
    stripeRefundId: string;
    stripePaymentIntentId: string;
    idempotencyKey?: string;
  },
  deps: {
    Invoice: Awaited<ReturnType<typeof getInvoiceModel>>;
    Payment: Awaited<ReturnType<typeof getPaymentModel>>;
    session: ClientSession;
  },
): Promise<ApplyStripeCardRefundResult> {
  const existingByRefund = await deps.Payment.findOne({
    "reconciliation.stripeRefundId": input.stripeRefundId,
  })
    .session(deps.session)
    .exec();

  if (existingByRefund) {
    const invoice = await deps.Invoice.findById(existingByRefund.invoiceId)
      .session(deps.session)
      .exec();
    if (!invoice) {
      throw new InvoiceNotFoundError();
    }
    if (existingByRefund.reconciliation.status === "matched") {
      return { applied: false, invoice, payment: existingByRefund };
    }
    // Pending row created at refunds.create time — promote to matched.
    return promotePendingRefund(
      existingByRefund,
      invoice,
      input.amountCents,
      input.receivedAt,
      deps.session,
    );
  }

  if (input.idempotencyKey) {
    const existingByKey = await deps.Payment.findOne({
      "reconciliation.idempotencyKey": input.idempotencyKey,
    })
      .session(deps.session)
      .exec();
    if (existingByKey) {
      const invoice = await deps.Invoice.findById(existingByKey.invoiceId)
        .session(deps.session)
        .exec();
      if (!invoice) {
        throw new InvoiceNotFoundError();
      }
      if (existingByKey.reconciliation.status === "matched") {
        return { applied: false, invoice, payment: existingByKey };
      }
      existingByKey.reconciliation.stripeRefundId = input.stripeRefundId;
      return promotePendingRefund(
        existingByKey,
        invoice,
        input.amountCents,
        input.receivedAt,
        deps.session,
      );
    }
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
  if (input.amountCents > caps.stripeRefundableCents) {
    throw new Error(
      `REFUND_EXCEEDS_CARD_PAID: amount=${input.amountCents} refundable=${caps.stripeRefundableCents}`,
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
        method: "card",
        amount: input.amountCents,
        reconciliation: {
          status: "matched",
          stripeRefundId: input.stripeRefundId,
          stripePaymentIntentId: input.stripePaymentIntentId,
          ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        },
        receivedAt: input.receivedAt,
      },
    ],
    { session: deps.session },
  );
  const payment = created[0];
  if (!payment) {
    throw new Error("Failed to create stripe card refund payment");
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

async function promotePendingRefund(
  payment: PaymentDocument,
  invoice: InvoiceDocument,
  amountCents: number,
  receivedAt: Date,
  session: ClientSession,
): Promise<ApplyStripeCardRefundResult> {
  if (payment.amount !== amountCents) {
    throw new Error(`Refund amount mismatch payment=${payment.amount} stripe=${amountCents}`);
  }

  const invoiceType = invoice.type;
  const nextPaidTotal = Math.max(0, invoice.totals.paidTotal - payment.amount);
  const nextBalanceDue = Math.max(0, invoice.totals.ttc - nextPaidTotal);
  const nextStatus =
    nextPaidTotal <= 0
      ? ("proforma" as const)
      : nextBalanceDue === 0
        ? ("paid" as const)
        : ("partially_paid" as const);

  payment.reconciliation.status = "matched";
  payment.receivedAt = receivedAt;
  await payment.save({ session });

  invoice.totals.paidTotal = nextPaidTotal;
  invoice.totals.balanceDue = nextBalanceDue;
  invoice.status = nextStatus;
  invoice.type = invoiceType;
  if (nextPaidTotal <= 0) {
    invoice.paidAt = undefined;
  }
  await invoice.save({ session });

  return { applied: true, invoice, payment };
}

/** Create a pending (not yet confirmed) Stripe refund payment row. */
export async function createPendingStripeCardRefund(input: {
  invoiceId: Types.ObjectId | string;
  amountCents: number;
  stripePaymentIntentId: string;
  idempotencyKey: string;
  stripeRefundId?: string;
  receivedAt?: Date;
}): Promise<{ created: boolean; payment: PaymentDocument; invoice: InvoiceDocument }> {
  const idempotencyKey = input.idempotencyKey.trim();
  const stripePaymentIntentId = input.stripePaymentIntentId.trim();
  if (!idempotencyKey) throw new Error("idempotencyKey is required");
  if (!stripePaymentIntentId) throw new Error("stripePaymentIntentId is required");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("amountCents must be a positive integer (cents)");
  }

  await connectMongo();
  const connection = await getCoworkDb();
  await assertReplicaSetForTransactions(connection);

  const Invoice = await getInvoiceModel();
  const Payment = await getPaymentModel();
  const receivedAt = input.receivedAt ?? new Date();
  const stripeRefundId = input.stripeRefundId?.trim() || undefined;

  const session = await connection.startSession();
  try {
    let out: { created: boolean; payment: PaymentDocument; invoice: InvoiceDocument } | undefined;

    await session.withTransaction(async () => {
      const existing = await Payment.findOne({
        "reconciliation.idempotencyKey": idempotencyKey,
      })
        .session(session)
        .exec();
      if (existing) {
        const invoice = await Invoice.findById(existing.invoiceId).session(session).exec();
        if (!invoice) throw new InvoiceNotFoundError();
        if (stripeRefundId && !existing.reconciliation.stripeRefundId) {
          existing.reconciliation.stripeRefundId = stripeRefundId;
          await existing.save({ session });
        }
        out = { created: false, payment: existing, invoice };
        return;
      }

      const invoice = await Invoice.findById(input.invoiceId).session(session).exec();
      if (!invoice) throw new InvoiceNotFoundError();

      const payments = await Payment.find({ invoiceId: invoice._id })
        .session(session)
        .lean()
        .exec();
      const caps = computePaymentRefundCaps(payments);
      if (input.amountCents > caps.stripeRefundableCents) {
        throw new Error(
          `REFUND_EXCEEDS_CARD_PAID: amount=${input.amountCents} refundable=${caps.stripeRefundableCents}`,
        );
      }

      const created = await Payment.create(
        [
          {
            currency: invoice.currency,
            invoiceId: invoice._id,
            cardexId: invoice.cardexId,
            kind: "refund",
            method: "card",
            amount: input.amountCents,
            reconciliation: {
              status: "pending",
              stripePaymentIntentId,
              idempotencyKey,
              ...(stripeRefundId ? { stripeRefundId } : {}),
            },
            receivedAt,
          },
        ],
        { session },
      );
      const payment = created[0];
      if (!payment) throw new Error("Failed to create pending stripe refund payment");
      out = { created: true, payment, invoice };
    });

    if (!out) throw new Error("createPendingStripeCardRefund produced no result");
    return out;
  } finally {
    await session.endSession();
  }
}

export async function markStripeCardRefundFailed(input: {
  stripeRefundId?: string;
  idempotencyKey?: string;
}): Promise<PaymentDocument | null> {
  await connectMongo();
  const Payment = await getPaymentModel();
  const filter = input.stripeRefundId
    ? { "reconciliation.stripeRefundId": input.stripeRefundId.trim() }
    : input.idempotencyKey
      ? { "reconciliation.idempotencyKey": input.idempotencyKey.trim() }
      : null;
  if (!filter) return null;

  const payment = await Payment.findOne(filter).exec();
  if (!payment || payment.reconciliation.status === "matched") {
    return payment;
  }
  payment.reconciliation.status = "failed";
  await payment.save();
  return payment;
}
