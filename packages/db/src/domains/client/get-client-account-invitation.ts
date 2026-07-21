import type { Types } from "mongoose";

import { connectMongo } from "../../connection.js";
import { getCardexModel } from "./cardex.schema.js";
import {
  getClientAccountInvitationModel,
  type ClientAccountInvitation,
} from "./client-account-invitation.schema.js";
import { ClientInvitationError } from "./client-invitation-errors.js";
import { hashClientInviteToken, isClientInviteTokenFormat } from "./invite-token.js";

export interface PublicInvitationPreview {
  emailMasked: string;
  companyLabel: string;
  expiresAt: Date;
  email: string;
  cardexId: Types.ObjectId;
  invitationId: Types.ObjectId;
}

export function maskClientInviteEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0) {
    return "***";
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function formatCardexCompanyLabel(
  cardex: {
    company?: { legalName?: string };
    identity?: { firstName?: string; lastName?: string };
  } | null,
): string {
  const legal = cardex?.company?.legalName?.trim();
  if (legal) return legal;
  const name = [cardex?.identity?.firstName, cardex?.identity?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || "votre société";
}

/**
 * Resolves a pending, non-expired invitation by raw token.
 * Throws typed ClientInvitationError for invalid / terminal states.
 */
export async function getPendingInvitationByRawToken(
  rawToken: string,
  tokenSecret: string,
  now: Date = new Date(),
): Promise<
  PublicInvitationPreview & { invitation: ClientAccountInvitation & { _id: Types.ObjectId } }
> {
  await connectMongo();

  if (!isClientInviteTokenFormat(rawToken)) {
    throw new ClientInvitationError(
      "INVITE_NOT_FOUND",
      "Cette invitation est introuvable ou n'est plus valide.",
    );
  }

  const tokenHash = hashClientInviteToken(rawToken, tokenSecret);
  const Invitation = await getClientAccountInvitationModel();
  const invitation = await Invitation.findOne({ tokenHash }).exec();

  if (!invitation) {
    throw new ClientInvitationError(
      "INVITE_NOT_FOUND",
      "Cette invitation est introuvable ou n'est plus valide.",
    );
  }

  assertInvitationAcceptable(invitation, now);

  const Cardex = await getCardexModel();
  const cardex = await Cardex.findById(invitation.cardexId).lean().exec();
  const companyLabel = formatCardexCompanyLabel(cardex);

  return {
    invitation: invitation.toObject() as ClientAccountInvitation & { _id: Types.ObjectId },
    invitationId: invitation._id,
    email: invitation.email,
    emailMasked: maskClientInviteEmail(invitation.email),
    companyLabel,
    expiresAt: invitation.expiresAt,
    cardexId: invitation.cardexId,
  };
}

/** Classify a loaded invitation for accept/get — pending+expired counts as expired. */
export function assertInvitationAcceptable(
  invitation: Pick<ClientAccountInvitation, "status" | "expiresAt">,
  now: Date,
): void {
  if (invitation.status === "accepted") {
    throw new ClientInvitationError("INVITE_ALREADY_USED", "Cette invitation a déjà été utilisée.");
  }
  if (invitation.status === "revoked") {
    throw new ClientInvitationError("INVITE_REVOKED", "Cette invitation a été révoquée.");
  }
  if (
    invitation.status === "expired" ||
    (invitation.status === "pending" && new Date(invitation.expiresAt).getTime() <= now.getTime())
  ) {
    throw new ClientInvitationError("INVITE_EXPIRED", "Cette invitation a expiré.");
  }
  if (invitation.status !== "pending") {
    throw new ClientInvitationError(
      "INVITE_NOT_FOUND",
      "Cette invitation est introuvable ou n'est plus valide.",
    );
  }
}
