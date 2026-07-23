import { hash } from "bcryptjs";
import type { Types } from "mongoose";

import { connectMongo } from "../../connection.js";
import { assertReplicaSetForTransactions } from "../../lib/replica-set.js";
import { ClientAccountActivationError } from "./client-account-activation-errors.js";
import { getClientAccountActivationModel } from "./client-account-activation.schema.js";
import { getClientAccountModel } from "./client-account.schema.js";
import { CLIENT_ACCOUNT_BCRYPT_ROUNDS, normalizeClientEmail } from "./create-client-account.js";
import {
  hashClientAccountActivationToken,
  isClientAccountActivationTokenFormat,
} from "./activation-token.js";

export interface ConsumeClientAccountActivationInput {
  rawToken: string;
  tokenSecret: string;
  password: string;
  now?: Date;
  /** Optional email confirmation — must match activation email when provided. */
  email?: string;
}

export interface ConsumeClientAccountActivationResult {
  clientAccountId: Types.ObjectId;
  email: string;
  cardexId?: Types.ObjectId;
  activatedAt: Date;
}

/**
 * Consumes a pending activation token: sets password and status → active.
 * Atomic: token consumed + account activated in one transaction.
 */
export async function consumeClientAccountActivation(
  input: ConsumeClientAccountActivationInput,
): Promise<ConsumeClientAccountActivationResult> {
  if (!isClientAccountActivationTokenFormat(input.rawToken)) {
    throw new ClientAccountActivationError(
      "ACTIVATION_NOT_FOUND",
      "Lien d'activation invalide ou introuvable.",
    );
  }

  const mongooseInstance = await connectMongo();
  await assertReplicaSetForTransactions(mongooseInstance.connection);

  const now = input.now ?? new Date();
  const tokenHash = hashClientAccountActivationToken(input.rawToken, input.tokenSecret);
  const passwordHash = await hash(input.password, CLIENT_ACCOUNT_BCRYPT_ROUNDS);
  const session = await mongooseInstance.startSession();

  let result: ConsumeClientAccountActivationResult | undefined;

  try {
    await session.withTransaction(async () => {
      const Activation = await getClientAccountActivationModel();
      const ClientAccount = await getClientAccountModel();

      const activation = await Activation.findOne({ tokenHash }).session(session).exec();
      if (!activation) {
        throw new ClientAccountActivationError(
          "ACTIVATION_NOT_FOUND",
          "Lien d'activation invalide ou introuvable.",
        );
      }
      if (activation.status === "consumed") {
        throw new ClientAccountActivationError(
          "ACTIVATION_ALREADY_USED",
          "Ce lien d'activation a déjà été utilisé.",
        );
      }
      if (activation.status === "revoked") {
        throw new ClientAccountActivationError(
          "ACTIVATION_REVOKED",
          "Ce lien d'activation a été révoqué.",
        );
      }
      if (activation.status !== "pending" || activation.expiresAt.getTime() <= now.getTime()) {
        throw new ClientAccountActivationError(
          "ACTIVATION_EXPIRED",
          "Ce lien d'activation a expiré.",
        );
      }

      if (input.email) {
        const normalized = normalizeClientEmail(input.email);
        if (normalized !== activation.email) {
          throw new ClientAccountActivationError(
            "ACTIVATION_EMAIL_MISMATCH",
            "L'email ne correspond pas à ce lien d'activation.",
          );
        }
      }

      const account = await ClientAccount.findById(activation.clientAccountId)
        .session(session)
        .exec();
      if (!account || account.status !== "pending_activation") {
        throw new ClientAccountActivationError(
          "ACTIVATION_ACCOUNT_INVALID",
          "Ce compte ne peut pas être activé.",
        );
      }

      const consumed = await Activation.findOneAndUpdate(
        { _id: activation._id, status: "pending" },
        { $set: { status: "consumed", consumedAt: now } },
        { session, new: true },
      ).exec();
      if (!consumed) {
        throw new ClientAccountActivationError(
          "ACTIVATION_ALREADY_USED",
          "Ce lien d'activation a déjà été utilisé.",
        );
      }

      const updated = await ClientAccount.findOneAndUpdate(
        { _id: account._id, status: "pending_activation" },
        {
          $set: {
            passwordHash,
            status: "active",
          },
        },
        { session, new: true },
      ).exec();
      if (!updated) {
        throw new ClientAccountActivationError(
          "ACTIVATION_ACCOUNT_INVALID",
          "Ce compte ne peut pas être activé.",
        );
      }

      result = {
        clientAccountId: updated._id,
        email: updated.email,
        cardexId: updated.cardexId ?? undefined,
        activatedAt: now,
      };
    });
  } finally {
    await session.endSession();
  }

  if (!result) {
    throw new Error("Activation consume failed without result");
  }
  return result;
}

/** Preview helper — lookup pending activation by raw token (no consume). */
export async function getPendingActivationByRawToken(
  rawToken: string,
  tokenSecret: string,
  now: Date = new Date(),
): Promise<{
  email: string;
  emailMasked: string;
  expiresAt: Date;
  clientAccountId: Types.ObjectId;
} | null> {
  if (!isClientAccountActivationTokenFormat(rawToken)) {
    return null;
  }
  await connectMongo();
  const Activation = await getClientAccountActivationModel();
  const tokenHash = hashClientAccountActivationToken(rawToken, tokenSecret);
  const activation = await Activation.findOne({ tokenHash }).lean().exec();
  if (!activation || activation.status !== "pending") {
    return null;
  }
  if (activation.expiresAt.getTime() <= now.getTime()) {
    return null;
  }
  return {
    email: activation.email,
    emailMasked: maskActivationEmail(activation.email),
    expiresAt: activation.expiresAt,
    clientAccountId: activation.clientAccountId,
  };
}

export function maskActivationEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return "***";
  }
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
