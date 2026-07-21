import { hash } from "bcryptjs";
import type { ClientSession, Types } from "mongoose";

import { EmailAlreadyRegisteredError, isDuplicateKeyError } from "../../lib/errors.js";
import type { ClientAccountRole } from "../../lib/enums.js";
import { getClientAccountModel } from "./client-account.schema.js";

/** Matches historical booking checkout hashing cost. */
export const CLIENT_ACCOUNT_BCRYPT_ROUNDS = 12;

export function normalizeClientEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface CreateClientAccountInput {
  email: string;
  password: string;
  role: ClientAccountRole;
  /** Defaults to `"unknown"` when omitted (booking checkout historical behavior). */
  privacyPolicyVersion?: string;
  marketingCommunicationsAccepted?: boolean;
  /** Set when attaching to an existing cardex (invite member flow). */
  cardexId?: Types.ObjectId;
  now: Date;
  session: ClientSession;
}

export interface CreateClientAccountResult {
  clientAccountId: Types.ObjectId;
}

/**
 * Creates a ClientAccount with bcrypt password + privacy/marketing consents.
 * Shared by booking checkout (owner) and invitation accept (member).
 * Must run inside an active Mongo session/transaction.
 */
export async function createClientAccount(
  input: CreateClientAccountInput,
): Promise<CreateClientAccountResult> {
  const ClientAccount = await getClientAccountModel();
  const normalizedEmail = normalizeClientEmail(input.email);
  const passwordHash = await hash(input.password, CLIENT_ACCOUNT_BCRYPT_ROUNDS);

  const existingEmail = await ClientAccount.findOne({ email: normalizedEmail })
    .session(input.session)
    .select({ _id: 1 })
    .lean()
    .exec();
  if (existingEmail) {
    throw new EmailAlreadyRegisteredError();
  }

  try {
    const [created] = await ClientAccount.create(
      [
        {
          email: normalizedEmail,
          passwordHash,
          consent: {
            privacyPolicyVersion: input.privacyPolicyVersion ?? "unknown",
            acceptedAt: input.now,
          },
          marketingConsent: {
            accepted: input.marketingCommunicationsAccepted === true,
            ...(input.marketingCommunicationsAccepted === true ? { acceptedAt: input.now } : {}),
          },
          status: "active",
          role: input.role,
          ...(input.cardexId ? { cardexId: input.cardexId } : {}),
        },
      ],
      { session: input.session },
    );

    if (!created) {
      throw new Error("Client account creation failed within transaction");
    }

    return { clientAccountId: created._id };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new EmailAlreadyRegisteredError();
    }
    throw error;
  }
}
