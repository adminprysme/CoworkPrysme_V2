import type { ClientSession, Types } from "mongoose";

import { connectMongo } from "../../connection.js";
import { resolveQuotePaymentLinkAmountCents } from "./quote-payment-link-amount.js";
import {
  getQuotePaymentLinkModel,
  type QuotePaymentLink,
  type QuotePaymentLinkDocument,
} from "./quote-payment-link.schema.js";
import {
  hashQuotePaymentLinkToken,
  isQuotePaymentLinkTokenFormat,
  issueQuotePaymentLinkToken,
} from "./quote-payment-link-token.js";

export type QuotePaymentLinkLookupErrorCode =
  | "PAYMENT_LINK_NOT_FOUND"
  | "PAYMENT_LINK_EXPIRED"
  | "PAYMENT_LINK_CONSUMED"
  | "PAYMENT_LINK_REVOKED";

export class QuotePaymentLinkLookupError extends Error {
  readonly code: QuotePaymentLinkLookupErrorCode;

  constructor(code: QuotePaymentLinkLookupErrorCode, message: string) {
    super(message);
    this.name = "QuotePaymentLinkLookupError";
    this.code = code;
  }
}

export interface CreateQuotePaymentLinkInput {
  quote: {
    _id: Types.ObjectId;
    depositPercent?: number | null;
    depositAmountTTC?: number | null;
    totals: { ttc: number };
    validUntil: Date;
    cardexId?: Types.ObjectId | null;
  };
  invoiceId: Types.ObjectId;
  reservationIds: Types.ObjectId[];
  cardexId: Types.ObjectId;
  tokenSecret: string;
  session?: ClientSession;
  now?: Date;
}

export interface CreateQuotePaymentLinkResult {
  paymentLinkId: Types.ObjectId;
  rawToken: string;
  amountDueCents: number;
  expiresAt: Date;
}

/** Creates an active payment link (tokenHash only persisted). */
export async function createQuotePaymentLink(
  input: CreateQuotePaymentLinkInput,
): Promise<CreateQuotePaymentLinkResult> {
  const amountDueCents = resolveQuotePaymentLinkAmountCents(input.quote);
  if (amountDueCents <= 0) {
    throw new Error("quote payment link amount must be positive");
  }

  const issued = issueQuotePaymentLinkToken(input.tokenSecret);
  const QuotePaymentLink = await getQuotePaymentLinkModel();
  const [doc] = await QuotePaymentLink.create(
    [
      {
        tokenHash: issued.tokenHash,
        quoteId: input.quote._id,
        invoiceId: input.invoiceId,
        reservationIds: input.reservationIds,
        cardexId: input.cardexId,
        status: "active",
        expiresAt: input.quote.validUntil,
        amountDueCentsSnapshot: amountDueCents,
      },
    ],
    input.session ? { session: input.session } : undefined,
  );

  if (!doc) {
    throw new Error("Failed to create quote payment link");
  }

  return {
    paymentLinkId: doc._id,
    rawToken: issued.rawToken,
    amountDueCents,
    expiresAt: input.quote.validUntil,
  };
}

export interface RedeemQuotePaymentLinkInput {
  rawToken: string;
  /** Strict membership — mismatch with stored invoiceId → uniform NOT_FOUND. */
  invoiceId: Types.ObjectId | string;
  tokenSecret: string;
  now?: Date;
}

/**
 * Redeem a payment link for preview / PI create.
 * Cross-invoice (valid token + wrong invoiceId) → PAYMENT_LINK_NOT_FOUND (404 uniform).
 */
export async function redeemQuotePaymentLink(
  input: RedeemQuotePaymentLinkInput,
): Promise<QuotePaymentLinkDocument> {
  await connectMongo();

  if (!isQuotePaymentLinkTokenFormat(input.rawToken)) {
    throw new QuotePaymentLinkLookupError(
      "PAYMENT_LINK_NOT_FOUND",
      "Lien de paiement introuvable.",
    );
  }

  const tokenHash = hashQuotePaymentLinkToken(input.rawToken, input.tokenSecret);
  const QuotePaymentLink = await getQuotePaymentLinkModel();
  const link = await QuotePaymentLink.findOne({ tokenHash }).exec();

  // Missing OR invoice membership mismatch → same 404 (no existence leak).
  if (!link || String(link.invoiceId) !== String(input.invoiceId)) {
    throw new QuotePaymentLinkLookupError(
      "PAYMENT_LINK_NOT_FOUND",
      "Lien de paiement introuvable.",
    );
  }

  const now = input.now ?? new Date();
  if (link.status === "consumed") {
    throw new QuotePaymentLinkLookupError(
      "PAYMENT_LINK_CONSUMED",
      "Ce lien de paiement a déjà été utilisé.",
    );
  }
  if (link.status === "revoked") {
    throw new QuotePaymentLinkLookupError(
      "PAYMENT_LINK_REVOKED",
      "Ce lien de paiement a été révoqué.",
    );
  }
  if (link.status === "expired" || link.expiresAt.getTime() < now.getTime()) {
    if (link.status === "active") {
      link.status = "expired";
      await link.save();
    }
    throw new QuotePaymentLinkLookupError("PAYMENT_LINK_EXPIRED", "Ce lien de paiement a expiré.");
  }

  return link;
}

export interface ConsumeQuotePaymentLinkInput {
  paymentLinkId: Types.ObjectId | string;
  stripePaymentIntentId: string;
  consumedAt?: Date;
  session?: ClientSession;
}

/** Marks link consumed (idempotent if already consumed for same PI). */
export async function consumeQuotePaymentLink(
  input: ConsumeQuotePaymentLinkInput,
): Promise<{ consumed: boolean; link: QuotePaymentLink | null }> {
  await connectMongo();
  const QuotePaymentLink = await getQuotePaymentLinkModel();
  const consumedAt = input.consumedAt ?? new Date();

  const existing = await QuotePaymentLink.findById(input.paymentLinkId)
    .session(input.session ?? null)
    .exec();
  if (!existing) {
    return { consumed: false, link: null };
  }
  if (existing.status === "consumed") {
    return { consumed: false, link: existing };
  }

  const updated = await QuotePaymentLink.findOneAndUpdate(
    { _id: existing._id, status: "active" },
    {
      $set: {
        status: "consumed",
        consumedAt,
        stripePaymentIntentId: input.stripePaymentIntentId,
      },
    },
    { returnDocument: "after", session: input.session },
  ).exec();

  return { consumed: Boolean(updated), link: updated ?? existing };
}
