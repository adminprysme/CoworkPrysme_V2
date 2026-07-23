import type { Types } from "mongoose";

import { resolveQuoteAcceptTokenExpiresAt } from "@coworkprysme/shared";

import { connectMongo } from "../../connection.js";
import type { Quote } from "./quote.schema.js";
import { getQuoteModel } from "./quote.schema.js";
import {
  hashQuoteAcceptToken,
  isQuoteAcceptTokenFormat,
  issueQuoteAcceptToken,
  quoteAcceptTokenMatchesHash,
} from "./quote-accept-token.js";

export type QuoteAcceptLookupErrorCode =
  "QUOTE_ACCEPT_NOT_FOUND" | "QUOTE_ACCEPT_EXPIRED" | "QUOTE_ACCEPT_INVALID_STATUS";

export class QuoteAcceptLookupError extends Error {
  readonly code: QuoteAcceptLookupErrorCode;

  constructor(code: QuoteAcceptLookupErrorCode, message: string) {
    super(message);
    this.name = "QuoteAcceptLookupError";
    this.code = code;
  }
}

export interface AttachQuoteAcceptTokenInput {
  quoteId: Types.ObjectId;
  tokenSecret: string;
  /**
   * Optional upper bound; final expiry is still
   * `min(expiresAt ?? validUntil, now + 30d)` (LOCKED product b).
   */
  expiresAt?: Date;
  /** Injectable clock for TTL tests. */
  now?: Date;
}

export interface AttachQuoteAcceptTokenResult {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Issues a new accept token and stores hash + expiresAt on the quote.
 * Caller puts `rawToken` in email/PDF only — never in DB/logs.
 */
export async function attachQuoteAcceptToken(
  input: AttachQuoteAcceptTokenInput,
): Promise<AttachQuoteAcceptTokenResult> {
  await connectMongo();
  const Quote = await getQuoteModel();
  const quote = await Quote.findById(input.quoteId).exec();
  if (!quote) {
    throw new QuoteAcceptLookupError("QUOTE_ACCEPT_NOT_FOUND", "Devis introuvable.");
  }

  const { rawToken, tokenHash } = issueQuoteAcceptToken(input.tokenSecret);
  const now = input.now ?? new Date();
  const validBound =
    input.expiresAt && input.expiresAt.getTime() < quote.validUntil.getTime()
      ? input.expiresAt
      : quote.validUntil;
  const expiresAt = resolveQuoteAcceptTokenExpiresAt(validBound, now);

  quote.acceptTokenHash = tokenHash;
  quote.acceptTokenExpiresAt = expiresAt;
  await quote.save();

  return { rawToken, tokenHash, expiresAt };
}

/**
 * Loads a quote by raw accept token. Does not redeem/clear the token
 * (token stays valid until accept succeeds — #8).
 */
export async function getQuoteByAcceptToken(
  rawToken: string,
  tokenSecret: string,
  now: Date = new Date(),
): Promise<Quote & { _id: Types.ObjectId }> {
  if (!isQuoteAcceptTokenFormat(rawToken)) {
    throw new QuoteAcceptLookupError(
      "QUOTE_ACCEPT_NOT_FOUND",
      "Lien d'acceptation invalide ou introuvable.",
    );
  }

  await connectMongo();
  const Quote = await getQuoteModel();
  const tokenHash = hashQuoteAcceptToken(rawToken, tokenSecret);
  const quote = await Quote.findOne({ acceptTokenHash: tokenHash }).lean().exec();

  if (!quote || !quote.acceptTokenHash) {
    throw new QuoteAcceptLookupError(
      "QUOTE_ACCEPT_NOT_FOUND",
      "Lien d'acceptation invalide ou introuvable.",
    );
  }

  // Defence in depth if hash algorithm ever changes.
  if (!quoteAcceptTokenMatchesHash(rawToken, quote.acceptTokenHash, tokenSecret)) {
    throw new QuoteAcceptLookupError(
      "QUOTE_ACCEPT_NOT_FOUND",
      "Lien d'acceptation invalide ou introuvable.",
    );
  }

  const expiresAt = quote.acceptTokenExpiresAt ?? quote.validUntil;
  if (expiresAt.getTime() <= now.getTime()) {
    throw new QuoteAcceptLookupError("QUOTE_ACCEPT_EXPIRED", "Ce lien d'acceptation a expiré.");
  }

  if (quote.status !== "sent") {
    throw new QuoteAcceptLookupError(
      "QUOTE_ACCEPT_INVALID_STATUS",
      quote.status === "accepted"
        ? "Ce devis a déjà été accepté."
        : "Ce devis n'est plus acceptable.",
    );
  }

  return quote as Quote & { _id: Types.ObjectId };
}

/** Whether an active (or pending_activation) account already exists for the quote email. */
export async function quoteAcceptNeedsRegistration(
  quote: Pick<Quote, "prospect" | "clientAccountId">,
): Promise<{ needsRegistration: boolean; email: string | null }> {
  const email = quote.prospect?.email?.trim().toLowerCase() ?? null;
  if (quote.clientAccountId) {
    return { needsRegistration: false, email };
  }
  if (!email) {
    return { needsRegistration: true, email: null };
  }

  const { getClientAccountModel } = await import("../client/client-account.schema.js");
  const ClientAccount = await getClientAccountModel();
  const existing = await ClientAccount.findOne({ email })
    .select({ _id: 1, status: 1 })
    .lean()
    .exec();

  if (!existing) {
    return { needsRegistration: true, email };
  }
  // pending_activation / active / locked → skip register form (login or activation path)
  return { needsRegistration: false, email };
}
