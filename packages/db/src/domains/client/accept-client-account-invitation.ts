import type { Types } from "mongoose";

import { connectMongo } from "../../connection.js";
import { EmailAlreadyRegisteredError } from "../../lib/errors.js";
import { assertReplicaSetForTransactions } from "../../lib/replica-set.js";
import { createClientAccount, normalizeClientEmail } from "./create-client-account.js";
import { getClientAccountModel } from "./client-account.schema.js";
import {
  getClientAccountInvitationModel,
  type ClientAccountInvitation,
} from "./client-account-invitation.schema.js";
import { ClientInvitationError } from "./client-invitation-errors.js";
import {
  assertInvitationAcceptable,
  formatCardexCompanyLabel,
  getPendingInvitationByRawToken,
} from "./get-client-account-invitation.js";
import { getCardexModel } from "./cardex.schema.js";
import { hashClientInviteToken, isClientInviteTokenFormat } from "./invite-token.js";

export interface AcceptClientAccountInvitationInput {
  rawToken: string;
  tokenSecret: string;
  password: string;
  privacyPolicyVersion: string;
  marketingCommunicationsAccepted?: boolean;
  now?: Date;
  /**
   * Test/proof hook: throw after the invite is marked accepted inside the
   * transaction to verify rollback restores pending. Never enable in production.
   */
  simulateFailureAfterConsume?: boolean;
}

export interface AcceptClientAccountInvitationResult {
  clientAccountId: Types.ObjectId;
  invitationId: Types.ObjectId;
  email: string;
  role: "member";
  cardexId: Types.ObjectId;
  companyLabel: string;
  acceptedAt: Date;
}

/**
 * Atomically consume a pending invitation and create a member ClientAccount.
 * Same withTransaction pattern as confirmBookingCheckout.
 */
export async function acceptClientAccountInvitation(
  input: AcceptClientAccountInvitationInput,
): Promise<AcceptClientAccountInvitationResult> {
  const mongooseInstance = await connectMongo();
  await assertReplicaSetForTransactions(mongooseInstance.connection);

  const now = input.now ?? new Date();

  if (!isClientInviteTokenFormat(input.rawToken)) {
    throw new ClientInvitationError(
      "INVITE_NOT_FOUND",
      "Cette invitation est introuvable ou n'est plus valide.",
    );
  }

  const tokenHash = hashClientInviteToken(input.rawToken, input.tokenSecret);
  // Resolve email/cardex for pre-checks without logging the raw token.
  const preview = await getPendingInvitationByRawToken(input.rawToken, input.tokenSecret, now);
  const normalizedEmail = normalizeClientEmail(preview.email);

  const ClientAccount = await getClientAccountModel();
  const existing = await ClientAccount.findOne({ email: normalizedEmail })
    .select({ _id: 1 })
    .lean()
    .exec();
  if (existing) {
    throw new ClientInvitationError(
      "INVITE_EMAIL_ALREADY_REGISTERED",
      "Un compte existe déjà avec cet email. Connectez-vous avec ce compte ou contactez le staff.",
    );
  }

  const session = await mongooseInstance.startSession();
  let result: AcceptClientAccountInvitationResult | undefined;

  try {
    await session.withTransaction(async () => {
      const Invitation = await getClientAccountInvitationModel();
      const consumed = await Invitation.findOneAndUpdate(
        {
          tokenHash,
          status: "pending",
          expiresAt: { $gt: now },
        },
        {
          $set: {
            status: "accepted",
            acceptedAt: now,
          },
        },
        { session, returnDocument: "after" },
      ).exec();

      if (!consumed) {
        const current = await Invitation.findOne({ tokenHash }).session(session).exec();
        if (!current) {
          throw new ClientInvitationError(
            "INVITE_NOT_FOUND",
            "Cette invitation est introuvable ou n'est plus valide.",
          );
        }
        assertInvitationAcceptable(current, now);
        // pending but lost the race on expiresAt filter
        throw new ClientInvitationError("INVITE_EXPIRED", "Cette invitation a expiré.");
      }

      if (input.simulateFailureAfterConsume) {
        throw new Error("SIMULATED_ACCEPT_FAILURE_AFTER_CONSUME");
      }

      let created;
      try {
        created = await createClientAccount({
          email: normalizedEmail,
          password: input.password,
          role: "member",
          cardexId: consumed.cardexId,
          privacyPolicyVersion: input.privacyPolicyVersion,
          marketingCommunicationsAccepted: input.marketingCommunicationsAccepted,
          now,
          session,
        });
      } catch (error) {
        if (error instanceof EmailAlreadyRegisteredError) {
          throw new ClientInvitationError(
            "INVITE_EMAIL_ALREADY_REGISTERED",
            "Un compte existe déjà avec cet email. Connectez-vous avec ce compte ou contactez le staff.",
          );
        }
        throw error;
      }

      await Invitation.updateOne(
        { _id: consumed._id },
        { $set: { acceptedClientAccountId: created.clientAccountId } },
        { session },
      ).exec();

      const Cardex = await getCardexModel();
      const cardex = await Cardex.findById(consumed.cardexId).session(session).lean().exec();

      result = {
        clientAccountId: created.clientAccountId,
        invitationId: consumed._id,
        email: normalizedEmail,
        role: "member",
        cardexId: consumed.cardexId,
        companyLabel: formatCardexCompanyLabel(cardex),
        acceptedAt: now,
      };
    });
  } finally {
    await session.endSession();
  }

  if (!result) {
    throw new Error("Invitation accept failed within transaction");
  }

  return result;
}

/** Reload invitation document after accept (or for proofs). */
export async function getInvitationById(
  invitationId: Types.ObjectId | string,
): Promise<(ClientAccountInvitation & { _id: Types.ObjectId }) | null> {
  await connectMongo();
  const Invitation = await getClientAccountInvitationModel();
  const doc = await Invitation.findById(invitationId).lean().exec();
  return doc as (ClientAccountInvitation & { _id: Types.ObjectId }) | null;
}
