import type { ClientSession, Types } from "mongoose";

import { connectMongo, getCoworkDb } from "../../connection.js";
import { InvoiceNotFoundError } from "../../lib/errors.js";
import { assertReplicaSetForTransactions } from "../../lib/replica-set.js";
import { getInvoiceModel, type InvoiceDocument } from "./invoice.schema.js";
import { getPaymentModel, type PaymentDocument } from "./payment.schema.js";

export interface ApplyStripeCardPaymentInput {
  stripePaymentIntentId: string;
  invoiceId: Types.ObjectId | string;
  /** Amount actually received (cents), from Stripe PaymentIntent — never from the client. */
  amountReceived: number;
  receivedAt?: Date;
}

export interface ApplyStripeCardPaymentResult {
  /** false when this PaymentIntent was already applied (idempotent replay). */
  applied: boolean;
  invoice: InvoiceDocument;
  payment: PaymentDocument;
}

/**
 * Apply a Stripe card payment to a proforma invoice.
 * Updates paidTotal / balanceDue / status only — never changes invoice.type (stays "proforma").
 */
export async function applyStripeCardPayment(
  input: ApplyStripeCardPaymentInput,
): Promise<ApplyStripeCardPaymentResult> {
  const stripePaymentIntentId = input.stripePaymentIntentId.trim();
  if (!stripePaymentIntentId) {
    throw new Error("stripePaymentIntentId is required");
  }
  if (!Number.isInteger(input.amountReceived) || input.amountReceived <= 0) {
    throw new Error("amountReceived must be a positive integer (cents)");
  }

  await connectMongo();
  const connection = await getCoworkDb();
  await assertReplicaSetForTransactions(connection);

  const Invoice = await getInvoiceModel();
  const Payment = await getPaymentModel();
  const receivedAt = input.receivedAt ?? new Date();

  const session = await connection.startSession();
  try {
    let result: ApplyStripeCardPaymentResult | undefined;

    await session.withTransaction(async () => {
      result = await applyStripeCardPaymentInSession(
        { ...input, stripePaymentIntentId, receivedAt },
        { Invoice, Payment, session },
      );
    });

    if (!result) {
      throw new Error("applyStripeCardPayment transaction produced no result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}

async function applyStripeCardPaymentInSession(
  input: ApplyStripeCardPaymentInput & { receivedAt: Date; stripePaymentIntentId: string },
  deps: {
    Invoice: Awaited<ReturnType<typeof getInvoiceModel>>;
    Payment: Awaited<ReturnType<typeof getPaymentModel>>;
    session: ClientSession;
  },
): Promise<ApplyStripeCardPaymentResult> {
  const existing = await deps.Payment.findOne({
    "reconciliation.stripePaymentIntentId": input.stripePaymentIntentId,
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

  // Permanent rule for Phase 4a: card payment never flips type to "final".
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
        method: "card",
        amount: input.amountReceived,
        reconciliation: {
          status: "matched",
          stripePaymentIntentId: input.stripePaymentIntentId,
        },
        receivedAt: input.receivedAt,
      },
    ],
    { session: deps.session },
  );
  const payment = created[0];
  if (!payment) {
    throw new Error("Failed to create payment");
  }

  invoice.totals.paidTotal = nextPaidTotal;
  invoice.totals.balanceDue = nextBalanceDue;
  invoice.status = nextStatus;
  invoice.type = invoiceType; // explicitly preserve (must stay "proforma" in Phase 4a)
  if (nextBalanceDue === 0) {
    invoice.paidAt = input.receivedAt;
  }
  await invoice.save({ session: deps.session });

  return { applied: true, invoice, payment };
}
