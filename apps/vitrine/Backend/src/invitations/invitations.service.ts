import { ConflictException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import {
  acceptClientAccountInvitation,
  ClientInvitationError,
  getClientAccountModel,
  getInvitationById,
  getPendingInvitationByRawToken,
} from "@coworkprysme/db";
import {
  CLIENT_INVITATION_ERROR_CODES,
  PRIVACY_POLICY_VERSION,
  PublicInvitationAcceptResponseSchema,
  PublicInvitationPreviewSchema,
  type PublicInvitationAcceptRequest,
  type PublicInvitationAcceptResponse,
  type PublicInvitationPreview,
} from "@coworkprysme/shared";
import { parseVitrineApiEnv } from "@coworkprysme/shared/server";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { MailService, mailDeliveryFromResult } from "../mail/mail.service.js";
import { renderInviteAcceptedEmail } from "./invitation-emails.js";

@Injectable()
export class InvitationsService {
  constructor(private readonly mail: MailService) {}

  private inviteSecret(): string {
    return parseVitrineApiEnv().CLIENT_INVITE_TOKEN_SECRET;
  }

  async getByToken(rawToken: string): Promise<PublicInvitationPreview> {
    try {
      const preview = await getPendingInvitationByRawToken(rawToken, this.inviteSecret());
      return PublicInvitationPreviewSchema.parse({
        emailMasked: preview.emailMasked,
        companyLabel: preview.companyLabel,
        expiresAt: preview.expiresAt.toISOString(),
      });
    } catch (error) {
      this.rethrowInvitationError(error);
    }
  }

  async accept(
    rawToken: string,
    input: PublicInvitationAcceptRequest,
  ): Promise<PublicInvitationAcceptResponse> {
    let accepted;
    try {
      accepted = await acceptClientAccountInvitation({
        rawToken,
        tokenSecret: this.inviteSecret(),
        password: input.password,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        marketingCommunicationsAccepted: input.marketingCommunicationsAccepted,
      });
    } catch (error) {
      this.rethrowInvitationError(error);
    }

    const invitation = await getInvitationById(accepted.invitationId);
    if (!invitation || invitation.status !== "accepted" || !invitation.acceptedClientAccountId) {
      throw new Error("Invitation accept succeeded but invitation document is inconsistent");
    }

    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findById(accepted.clientAccountId).lean().exec();
    if (!account) {
      throw new Error("Invitation accept succeeded but client account is missing");
    }

    const emailContent = renderInviteAcceptedEmail({ companyLabel: accepted.companyLabel });
    const mailResult = await this.mail.sendMail({
      to: accepted.email,
      subject: emailContent.subject,
      html: emailContent.html,
    });
    const delivery = mailDeliveryFromResult(mailResult);

    return PublicInvitationAcceptResponseSchema.parse({
      clientAccount: {
        id: String(account._id),
        email: account.email,
        role: "member",
        cardexId: String(account.cardexId),
        status: "active",
      },
      invitation: {
        id: String(invitation._id),
        status: "accepted",
        acceptedAt: new Date(invitation.acceptedAt!).toISOString(),
        acceptedClientAccountId: String(invitation.acceptedClientAccountId),
        cardexId: String(invitation.cardexId),
      },
      companyLabel: accepted.companyLabel,
      emailSent: delivery.emailSent,
      ...(delivery.emailError ? { emailError: delivery.emailError } : {}),
    });
  }

  private rethrowInvitationError(error: unknown): never {
    if (error instanceof ClientInvitationError) {
      const body = { code: error.code, message: error.message };
      switch (error.code) {
        case "INVITE_NOT_FOUND":
          throw new NotFoundException(body);
        case "INVITE_EXPIRED":
          throw new GoneException(body);
        case "INVITE_REVOKED":
        case "INVITE_ALREADY_USED":
        case "INVITE_EMAIL_ALREADY_REGISTERED":
          throw new ConflictException(body);
        default:
          throw new NotFoundException({
            code: CLIENT_INVITATION_ERROR_CODES.INVITE_NOT_FOUND,
            message: "Cette invitation est introuvable ou n'est plus valide.",
          });
      }
    }
    throw error;
  }
}
