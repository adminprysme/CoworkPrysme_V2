import { createHash, randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CLIENT_ACCOUNT_INVITATION_TTL_MS,
  connectMongo,
  getCardexModel,
  getClientAccountInvitationModel,
  getClientAccountModel,
  getReservationModel,
  type ClientAccountInvitation,
  type StaffProfileDocument,
} from "@coworkprysme/db";
import {
  PlanningInvitationMutationResultSchema,
  PlanningInvitationListResponseSchema,
  PlanningInvitationSchema,
  type PlanningCreateInvitationRequest,
  type PlanningInvitation,
  type PlanningInvitationEffectiveStatus,
  type PlanningInvitationMutationResult,
} from "@coworkprysme/shared";
import { parseGestionApiEnv } from "@coworkprysme/shared/server";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { MailService } from "../mail/mail.service.js";
import {
  emailDeliveryAuditDiff,
  mailDeliveryFromResult,
  type SendMailResult,
} from "../mail/mail.service.js";
import { writePlanningManageAudit } from "./planning-manage-audit.js";
import { renderClientInviteEmail } from "./planning-invite-emails.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function assertObjectId(value: string, label: string): string {
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw new BadRequestException({
      code: "INVALID_ID",
      message: `${label} invalide`,
    });
  }
  return value;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashInviteToken(rawToken: string, secret: string): string {
  return createHash("sha256").update(`${rawToken}:${secret}`).digest("hex");
}

function toIso(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

function effectiveStatus(
  invitation: Pick<ClientAccountInvitation, "status" | "expiresAt">,
  now: Date = new Date(),
): PlanningInvitationEffectiveStatus {
  if (
    invitation.status === "pending" &&
    new Date(invitation.expiresAt).getTime() <= now.getTime()
  ) {
    return "expired";
  }
  return invitation.status;
}

function mapInvitation(doc: ClientAccountInvitation & { _id: Types.ObjectId }): PlanningInvitation {
  return PlanningInvitationSchema.parse({
    id: String(doc._id),
    email: doc.email,
    status: effectiveStatus(doc),
    storedStatus: doc.status,
    expiresAt: toIso(doc.expiresAt)!,
    lastSentAt: toIso(doc.lastSentAt)!,
    createdAt: toIso(doc.createdAt)!,
    invitedByStaffProfileId: String(doc.invitedByStaffProfileId),
    ...(doc.revokedByStaffProfileId
      ? { revokedByStaffProfileId: String(doc.revokedByStaffProfileId) }
      : {}),
    ...(doc.revokedAt ? { revokedAt: toIso(doc.revokedAt) } : {}),
    ...(doc.acceptedAt ? { acceptedAt: toIso(doc.acceptedAt) } : {}),
    ...(doc.acceptedClientAccountId
      ? { acceptedClientAccountId: String(doc.acceptedClientAccountId) }
      : {}),
    ...(doc.reservationId ? { reservationId: String(doc.reservationId) } : {}),
    cardexId: String(doc.cardexId),
  });
}

@Injectable()
export class PlanningInvitationsService {
  constructor(private readonly mail: MailService) {}

  private inviteSecret(): string {
    return parseGestionApiEnv().CLIENT_INVITE_TOKEN_SECRET;
  }

  async listForReservation(
    _profile: StaffProfileDocument,
    reservationId: string,
  ): Promise<{ invitations: PlanningInvitation[] }> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");
    const { cardexId } = await this.loadReservationCardex(id);

    const Invitation = await getClientAccountInvitationModel();
    const rows = await Invitation.find({ cardexId }).sort({ createdAt: -1 }).lean().exec();

    return PlanningInvitationListResponseSchema.parse({
      invitations: rows.map((row) => mapInvitation(row as never)),
    });
  }

  async createForReservation(
    profile: StaffProfileDocument,
    reservationId: string,
    input: PlanningCreateInvitationRequest,
  ): Promise<PlanningInvitationMutationResult> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");
    const email = normalizeEmail(input.email);
    const { reservation, cardexId, companyLabel } = await this.loadReservationCardex(id);

    await this.assertEmailEligible(email, cardexId);

    const Invitation = await getClientAccountInvitationModel();
    const existingPending = await Invitation.findOne({
      cardexId,
      email,
      status: "pending",
    })
      .select({ _id: 1 })
      .lean()
      .exec();
    if (existingPending) {
      throw new ConflictException({
        code: "INVITE_ALREADY_PENDING",
        message:
          "Une invitation est déjà en attente pour cet email sur ce dossier. Utilisez renvoyer ou révoquer.",
      });
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashInviteToken(rawToken, this.inviteSecret());
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CLIENT_ACCOUNT_INVITATION_TTL_MS);

    const [created] = await Invitation.create([
      {
        cardexId,
        email,
        tokenHash,
        status: "pending",
        expiresAt,
        invitedByStaffProfileId: profile._id,
        reservationId: reservation._id,
        lastSentAt: now,
      },
    ]);
    if (!created) {
      throw new Error("Invitation creation failed");
    }

    const mailResult = await this.sendInviteEmail({
      email,
      companyLabel,
      expiresAt,
      rawToken,
    });
    // rawToken must not escape this scope into logs/audits.
    void rawToken;

    const delivery = mailDeliveryFromResult(mailResult);
    await writePlanningManageAudit({
      profile,
      action: "client.invitation.create",
      reservationId: reservation._id,
      diff: {
        invitationId: { before: null, after: String(created._id) },
        inviteEmail: { before: null, after: email },
        ...emailDeliveryAuditDiff(delivery),
      },
    });

    return PlanningInvitationMutationResultSchema.parse({
      invitation: mapInvitation(created.toObject() as never),
      emailSent: delivery.emailSent,
      ...(delivery.emailError ? { emailError: delivery.emailError } : {}),
    });
  }

  async resend(
    profile: StaffProfileDocument,
    invitationId: string,
  ): Promise<PlanningInvitationMutationResult> {
    await connectMongo();
    const id = assertObjectId(invitationId, "invitationId");
    const Invitation = await getClientAccountInvitationModel();
    const existing = await Invitation.findById(id).exec();
    if (!existing) {
      throw new NotFoundException({
        code: "INVITE_NOT_FOUND",
        message: "Invitation introuvable",
      });
    }

    const effective = effectiveStatus(existing);
    if (effective !== "pending") {
      throw new ConflictException({
        code: "INVITE_NOT_RESENDABLE",
        message:
          effective === "expired"
            ? "Cette invitation est expirée — créez-en une nouvelle."
            : `Impossible de renvoyer une invitation au statut « ${effective} ».`,
      });
    }

    await this.assertEmailEligible(existing.email, existing.cardexId);

    const Cardex = await getCardexModel();
    const cardex = await Cardex.findById(existing.cardexId).lean().exec();
    const companyLabel = this.formatCompanyLabel(cardex);

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashInviteToken(rawToken, this.inviteSecret());
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CLIENT_ACCOUNT_INVITATION_TTL_MS);

    const mongooseInstance = await connectMongo();
    const session = await mongooseInstance.startSession();
    let createdId: Types.ObjectId | undefined;
    try {
      await session.withTransaction(async () => {
        const revoked = await Invitation.findOneAndUpdate(
          { _id: existing._id, status: "pending" },
          {
            $set: {
              status: "revoked",
              revokedAt: now,
              revokedByStaffProfileId: profile._id,
            },
          },
          { session, new: true },
        ).exec();
        if (!revoked) {
          throw new ConflictException({
            code: "INVITE_NOT_RESENDABLE",
            message: "L'invitation n'est plus en attente — renvoi impossible.",
          });
        }

        const [created] = await Invitation.create(
          [
            {
              cardexId: existing.cardexId,
              email: existing.email,
              tokenHash,
              status: "pending",
              expiresAt,
              invitedByStaffProfileId: profile._id,
              reservationId: existing.reservationId,
              lastSentAt: now,
            },
          ],
          { session },
        );
        if (!created) {
          throw new Error("Invitation resend create failed");
        }
        createdId = created._id;
      });
    } finally {
      await session.endSession();
    }

    if (!createdId) {
      throw new Error("Invitation resend produced no id");
    }

    const created = await Invitation.findById(createdId).lean().exec();
    if (!created) {
      throw new Error("Invitation resend reload failed");
    }

    const mailResult = await this.sendInviteEmail({
      email: existing.email,
      companyLabel,
      expiresAt,
      rawToken,
    });
    void rawToken;

    const delivery = mailDeliveryFromResult(mailResult);
    const reservationId = existing.reservationId ?? created.reservationId;
    if (reservationId) {
      await writePlanningManageAudit({
        profile,
        action: "client.invitation.resend",
        reservationId,
        diff: {
          revokedInvitationId: { before: String(existing._id), after: String(existing._id) },
          invitationId: { before: null, after: String(created._id) },
          inviteEmail: { before: null, after: existing.email },
          ...emailDeliveryAuditDiff(delivery),
        },
      });
    }

    return PlanningInvitationMutationResultSchema.parse({
      invitation: mapInvitation(created as never),
      emailSent: delivery.emailSent,
      ...(delivery.emailError ? { emailError: delivery.emailError } : {}),
      revokedInvitationId: String(existing._id),
    });
  }

  async revoke(profile: StaffProfileDocument, invitationId: string): Promise<PlanningInvitation> {
    await connectMongo();
    const id = assertObjectId(invitationId, "invitationId");
    const Invitation = await getClientAccountInvitationModel();
    const existing = await Invitation.findById(id).exec();
    if (!existing) {
      throw new NotFoundException({
        code: "INVITE_NOT_FOUND",
        message: "Invitation introuvable",
      });
    }

    const effective = effectiveStatus(existing);
    if (effective !== "pending") {
      throw new ConflictException({
        code: "INVITE_NOT_REVOCABLE",
        message:
          effective === "revoked"
            ? "Cette invitation est déjà révoquée."
            : effective === "accepted"
              ? "Cette invitation a déjà été acceptée — révocation impossible."
              : "Cette invitation est expirée — révocation impossible.",
      });
    }

    const now = new Date();
    existing.status = "revoked";
    existing.revokedAt = now;
    existing.revokedByStaffProfileId = profile._id;
    await existing.save();

    if (existing.reservationId) {
      await writePlanningManageAudit({
        profile,
        action: "client.invitation.revoke",
        reservationId: existing.reservationId,
        diff: {
          invitationId: { before: String(existing._id), after: String(existing._id) },
          inviteStatus: { before: "pending", after: "revoked" },
          inviteEmail: { before: existing.email, after: existing.email },
        },
      });
    }

    return mapInvitation(existing.toObject() as never);
  }

  private async loadReservationCardex(reservationId: string): Promise<{
    reservation: { _id: Types.ObjectId; reference: string; cardexId: Types.ObjectId };
    cardexId: Types.ObjectId;
    companyLabel: string;
  }> {
    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(reservationId)
      .select({ reference: 1, cardexId: 1 })
      .lean()
      .exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!reservation.cardexId) {
      throw new BadRequestException({
        code: "RESERVATION_NO_CARDEX",
        message: "Cette réservation n'a pas de cardex — invitation impossible.",
      });
    }

    const Cardex = await getCardexModel();
    const cardex = await Cardex.findById(reservation.cardexId).lean().exec();
    if (!cardex) {
      throw new BadRequestException({
        code: "RESERVATION_NO_CARDEX",
        message: "Cardex introuvable pour cette réservation.",
      });
    }

    return {
      reservation: {
        _id: reservation._id as Types.ObjectId,
        reference: reservation.reference,
        cardexId: reservation.cardexId as Types.ObjectId,
      },
      cardexId: reservation.cardexId as Types.ObjectId,
      companyLabel: this.formatCompanyLabel(cardex),
    };
  }

  private formatCompanyLabel(
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

  private async assertEmailEligible(email: string, cardexId: Types.ObjectId): Promise<void> {
    const ClientAccount = await getClientAccountModel();
    const existing = await ClientAccount.findOne({ email })
      .select({ _id: 1, cardexId: 1 })
      .lean()
      .exec();
    if (!existing) {
      return;
    }
    if (existing.cardexId && String(existing.cardexId) === String(cardexId)) {
      throw new ConflictException({
        code: "INVITE_EMAIL_ALREADY_ON_CARDEX",
        message: "Cet email est déjà rattaché à ce dossier.",
      });
    }
    throw new ConflictException({
      code: "INVITE_EMAIL_ALREADY_REGISTERED",
      message: "Un compte existe déjà avec cet email.",
    });
  }

  private async sendInviteEmail(input: {
    email: string;
    companyLabel: string;
    expiresAt: Date;
    rawToken: string;
  }): Promise<SendMailResult> {
    const inviteUrl = `${this.publicInviteBaseUrl()}/invitation?token=${input.rawToken}`;
    const email = renderClientInviteEmail({
      companyLabel: input.companyLabel,
      expiresAtLabel: input.expiresAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      inviteUrl,
    });
    return this.mail.sendMail({
      to: input.email,
      subject: email.subject,
      html: email.html,
    });
  }

  private publicInviteBaseUrl(): string {
    // Same public site as other transactional emails (vitrine).
    const fromEnv = process.env.PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (fromEnv) {
      return fromEnv.replace(/\/$/, "");
    }
    // Local / default — never include the token in any derived log.
    return "http://localhost:3001";
  }
}
