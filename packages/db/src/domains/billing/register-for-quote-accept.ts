import type { ClientSession, Types } from "mongoose";

import { createClientAccount, normalizeClientEmail } from "../client/create-client-account.js";
import type { QuoteProspect } from "../../lib/subdocuments.js";

export interface RegisterClientAccountForQuoteAcceptInput {
  /** Email from quote.prospect (authoritative — not client-supplied alternate). */
  email: string;
  password: string;
  privacyPolicyVersion: string;
  marketingCommunicationsAccepted?: boolean;
  now: Date;
  session: ClientSession;
  /** Optional: when register also stamps identity onto a later cardex (#8). */
  prospect?: QuoteProspect;
}

export interface RegisterClientAccountForQuoteAcceptResult {
  clientAccountId: Types.ObjectId;
  email: string;
}

/**
 * Vitrine register-on-accept foundation (§5.1.2 path a):
 * creates an **active** owner account with the password chosen at accept time.
 * Cardex + reservations are created later by AcceptQuoteService (#8).
 *
 * Must run inside an active Mongo session/transaction.
 */
export async function registerClientAccountForQuoteAccept(
  input: RegisterClientAccountForQuoteAcceptInput,
): Promise<RegisterClientAccountForQuoteAcceptResult> {
  const email = normalizeClientEmail(input.email);
  const created = await createClientAccount({
    email,
    password: input.password,
    role: "owner",
    status: "active",
    privacyPolicyVersion: input.privacyPolicyVersion,
    marketingCommunicationsAccepted: input.marketingCommunicationsAccepted,
    now: input.now,
    session: input.session,
  });

  return {
    clientAccountId: created.clientAccountId,
    email,
  };
}
