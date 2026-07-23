import type { ClientSession, Types } from "mongoose";

import { CLIENT_ACCOUNT_ACTIVATION_TTL_MS } from "../../lib/enums.js";
import { getClientAccountActivationModel } from "./client-account-activation.schema.js";
import { issueClientAccountActivationToken } from "./activation-token.js";
import { normalizeClientEmail } from "./create-client-account.js";

export interface IssueClientAccountActivationInput {
  clientAccountId: Types.ObjectId;
  email: string;
  tokenSecret: string;
  now: Date;
  session: ClientSession;
  /** Optional TTL override (ms). Defaults to CLIENT_ACCOUNT_ACTIVATION_TTL_MS. */
  ttlMs?: number;
  quoteId?: Types.ObjectId;
  issuedByStaffProfileId?: Types.ObjectId;
}

export interface IssueClientAccountActivationResult {
  activationId: Types.ObjectId;
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Revokes any pending activation for the account, then creates a fresh token.
 * Must run inside an active Mongo session/transaction.
 * Caller emails `rawToken` and must not persist it.
 */
export async function issueClientAccountActivation(
  input: IssueClientAccountActivationInput,
): Promise<IssueClientAccountActivationResult> {
  const Activation = await getClientAccountActivationModel();
  const email = normalizeClientEmail(input.email);
  const now = input.now;
  const ttlMs = input.ttlMs ?? CLIENT_ACCOUNT_ACTIVATION_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttlMs);
  const { rawToken, tokenHash } = issueClientAccountActivationToken(input.tokenSecret);

  await Activation.updateMany(
    { clientAccountId: input.clientAccountId, status: "pending" },
    { $set: { status: "revoked", revokedAt: now } },
    { session: input.session },
  ).exec();

  const [created] = await Activation.create(
    [
      {
        clientAccountId: input.clientAccountId,
        email,
        tokenHash,
        status: "pending",
        expiresAt,
        lastSentAt: now,
        ...(input.quoteId ? { quoteId: input.quoteId } : {}),
        ...(input.issuedByStaffProfileId
          ? { issuedByStaffProfileId: input.issuedByStaffProfileId }
          : {}),
      },
    ],
    { session: input.session },
  );

  if (!created) {
    throw new Error("Client account activation creation failed within transaction");
  }

  return {
    activationId: created._id,
    rawToken,
    tokenHash,
    expiresAt,
  };
}
