import { randomBytes } from "node:crypto";
import type { ClientSession, Types } from "mongoose";

import { EmailAlreadyRegisteredError } from "../../lib/errors.js";
import type { QuoteProspect } from "../../lib/subdocuments.js";
import { getCardexModel } from "../client/cardex.schema.js";
import { getClientAccountModel } from "../client/client-account.schema.js";
import { createClientAccount, normalizeClientEmail } from "../client/create-client-account.js";
import { issueClientAccountActivation } from "../client/issue-client-account-activation.js";

export class QuoteBootstrapError extends Error {
  readonly code:
    | "PROSPECT_REQUIRED"
    | "PROSPECT_IDENTITY_INCOMPLETE"
    | "ACCOUNT_ALREADY_EXISTS"
    | "ACCOUNT_NOT_BOOTSTRAPPABLE";

  constructor(code: QuoteBootstrapError["code"], message: string) {
    super(message);
    this.name = "QuoteBootstrapError";
    this.code = code;
  }
}

export interface BootstrapQuoteClientFromProspectInput {
  prospect: QuoteProspect;
  tokenSecret: string;
  now: Date;
  session: ClientSession;
  quoteId?: Types.ObjectId;
  issuedByStaffProfileId?: Types.ObjectId;
  privacyPolicyVersion?: string;
}

export interface BootstrapQuoteClientFromProspectResult {
  cardexId: Types.ObjectId;
  clientAccountId: Types.ObjectId;
  activationRawToken: string;
  activationExpiresAt: Date;
  activationId: Types.ObjectId;
  /** True when a new account+cardex were created; false when reusing active path is not used. */
  created: true;
}

/**
 * Staff-accept bootstrap (§5.1.3): Cardex + owner ClientAccount `pending_activation`
 * + activation token. Does NOT create reservations/invoice — AcceptQuoteService (#8) calls this.
 *
 * Must run inside an active Mongo session/transaction.
 * Caller emails `activationRawToken` and must not persist it.
 */
export async function bootstrapQuoteClientFromProspect(
  input: BootstrapQuoteClientFromProspectInput,
): Promise<BootstrapQuoteClientFromProspectResult> {
  const prospect = input.prospect;
  if (!prospect?.email) {
    throw new QuoteBootstrapError(
      "PROSPECT_REQUIRED",
      "Le devis doit porter un prospect (email) pour le bootstrap staff-accept.",
    );
  }

  const identity = resolveProspectIdentity(prospect);
  if (!identity) {
    throw new QuoteBootstrapError(
      "PROSPECT_IDENTITY_INCOMPLETE",
      "Le prospect doit inclure prénom et nom (ou displayName) pour créer le cardex.",
    );
  }

  const ClientAccount = await getClientAccountModel();
  const email = normalizeClientEmail(prospect.email);
  const existing = await ClientAccount.findOne({ email })
    .session(input.session)
    .select({ _id: 1, status: 1, cardexId: 1, role: 1 })
    .lean()
    .exec();

  if (existing) {
    // Reuse path for #8: if already active/locked/pending with cardex, AcceptQuoteService
    // should link rather than bootstrap. Here we refuse duplicate create.
    throw new QuoteBootstrapError(
      "ACCOUNT_ALREADY_EXISTS",
      "Un compte existe déjà pour cet email — liez le devis au cardex existant.",
    );
  }

  // Sentinel password — login blocked by pending_activation before bcrypt compare.
  const sentinelPassword = randomBytes(32).toString("hex");

  let createdAccountId: Types.ObjectId;
  try {
    const created = await createClientAccount({
      email,
      password: sentinelPassword,
      role: "owner",
      status: "pending_activation",
      privacyPolicyVersion: input.privacyPolicyVersion ?? "pending-activation",
      marketingCommunicationsAccepted: false,
      now: input.now,
      session: input.session,
    });
    createdAccountId = created.clientAccountId;
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      throw new QuoteBootstrapError(
        "ACCOUNT_ALREADY_EXISTS",
        "Un compte existe déjà pour cet email — liez le devis au cardex existant.",
      );
    }
    throw error;
  }

  const Cardex = await getCardexModel();
  const [cardex] = await Cardex.create(
    [
      {
        clientAccountId: createdAccountId,
        identity,
        ...(prospect.billingAddress && !prospect.companyName
          ? { address: prospect.billingAddress }
          : {}),
        ...(prospect.companyName
          ? {
              company: {
                legalName: prospect.companyName,
                ...(prospect.billingAddress ? { billingAddress: prospect.billingAddress } : {}),
              },
            }
          : {}),
        documents: [],
        preferentialCodeIds: [],
        billingSummary: { depositsTotal: 0, balanceDue: 0 },
        retentionStatus: "active",
      },
    ],
    { session: input.session },
  );

  if (!cardex) {
    throw new Error("Cardex creation failed within bootstrap transaction");
  }

  await ClientAccount.updateOne(
    { _id: createdAccountId },
    { $set: { cardexId: cardex._id } },
    { session: input.session },
  ).exec();

  const activation = await issueClientAccountActivation({
    clientAccountId: createdAccountId,
    email,
    tokenSecret: input.tokenSecret,
    now: input.now,
    session: input.session,
    quoteId: input.quoteId,
    issuedByStaffProfileId: input.issuedByStaffProfileId,
  });

  return {
    cardexId: cardex._id,
    clientAccountId: createdAccountId,
    activationRawToken: activation.rawToken,
    activationExpiresAt: activation.expiresAt,
    activationId: activation.activationId,
    created: true,
  };
}

/** Maps prospect → CardexIdentity (firstName/lastName required by schema). */
export function resolveProspectIdentity(
  prospect: QuoteProspect,
): { firstName: string; lastName: string; phone?: string } | null {
  const phone = prospect.phone?.trim() || undefined;

  if (prospect.firstName?.trim() && prospect.lastName?.trim()) {
    return {
      firstName: prospect.firstName.trim(),
      lastName: prospect.lastName.trim(),
      ...(phone ? { phone } : {}),
    };
  }

  const display = prospect.displayName?.trim();
  if (display) {
    const parts = display.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return {
        firstName: parts[0]!,
        lastName: parts.slice(1).join(" "),
        ...(phone ? { phone } : {}),
      };
    }
    if (parts.length === 1) {
      return {
        firstName: parts[0]!,
        lastName: parts[0]!,
        ...(phone ? { phone } : {}),
      };
    }
  }

  return null;
}
