import { z } from "zod";

/** Mirrors packages/db CLIENT_ACCOUNT_INVITATION_STATUSES (keep in sync). */
export const PlanningInvitationStoredStatusSchema = z.enum([
  "pending",
  "accepted",
  "expired",
  "revoked",
]);
export type PlanningInvitationStoredStatus = z.infer<typeof PlanningInvitationStoredStatusSchema>;

/** Effective status for staff UI — pending past expiresAt is shown as expired. */
export const PlanningInvitationEffectiveStatusSchema = z.enum([
  "pending",
  "accepted",
  "expired",
  "revoked",
]);
export type PlanningInvitationEffectiveStatus = z.infer<
  typeof PlanningInvitationEffectiveStatusSchema
>;

export const PlanningCreateInvitationRequestSchema = z.object({
  email: z.string().trim().email().max(254),
});
export type PlanningCreateInvitationRequest = z.infer<typeof PlanningCreateInvitationRequestSchema>;

export const PlanningInvitationSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  status: PlanningInvitationEffectiveStatusSchema,
  /** Stored status before effective expiry derivation (pending may display as expired). */
  storedStatus: PlanningInvitationStoredStatusSchema,
  expiresAt: z.string().datetime(),
  lastSentAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  invitedByStaffProfileId: z.string(),
  revokedByStaffProfileId: z.string().optional(),
  revokedAt: z.string().datetime().optional(),
  acceptedAt: z.string().datetime().optional(),
  acceptedClientAccountId: z.string().optional(),
  reservationId: z.string().optional(),
  cardexId: z.string(),
});
export type PlanningInvitation = z.infer<typeof PlanningInvitationSchema>;

export const PlanningInvitationMutationResultSchema = z.object({
  invitation: PlanningInvitationSchema,
  /** Honest SMTP delivery outcome for this mutation's send attempt. */
  emailSent: z.boolean(),
  emailError: z.string().optional(),
  /** Present on resend: the invitation that was revoked. */
  revokedInvitationId: z.string().optional(),
});
export type PlanningInvitationMutationResult = z.infer<
  typeof PlanningInvitationMutationResultSchema
>;

export const PlanningInvitationListResponseSchema = z.object({
  invitations: z.array(PlanningInvitationSchema),
});
export type PlanningInvitationListResponse = z.infer<typeof PlanningInvitationListResponseSchema>;

/** Public vitrine-api invitation error codes. */
export const CLIENT_INVITATION_ERROR_CODES = {
  INVITE_NOT_FOUND: "INVITE_NOT_FOUND",
  INVITE_EXPIRED: "INVITE_EXPIRED",
  INVITE_REVOKED: "INVITE_REVOKED",
  INVITE_ALREADY_USED: "INVITE_ALREADY_USED",
  INVITE_EMAIL_ALREADY_REGISTERED: "INVITE_EMAIL_ALREADY_REGISTERED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type ClientInvitationErrorCode =
  (typeof CLIENT_INVITATION_ERROR_CODES)[keyof typeof CLIENT_INVITATION_ERROR_CODES];

/** GET /invitations/:token — minimal public preview (never tokenHash). */
export const PublicInvitationPreviewSchema = z.object({
  emailMasked: z.string().min(1),
  companyLabel: z.string().min(1),
  expiresAt: z.string().datetime(),
});
export type PublicInvitationPreview = z.infer<typeof PublicInvitationPreviewSchema>;

/**
 * POST /invitations/:token/accept — password + consents aligned with booking
 * new-account rules (CGV + privacy). No identity/address (member joins existing cardex).
 */
export const PublicInvitationAcceptRequestSchema = z
  .object({
    password: z.string().min(8, "Mot de passe invalide"),
    privacyPolicyAccepted: z.boolean().optional(),
    marketingCommunicationsAccepted: z.boolean().optional(),
    cgvAccepted: z.literal(true, { message: "L'acceptation des CGV est obligatoire" }),
  })
  .superRefine((value, context) => {
    if (!value.privacyPolicyAccepted) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["privacyPolicyAccepted"],
        message: "Le consentement à la politique de confidentialité est obligatoire",
      });
    }
  });
export type PublicInvitationAcceptRequest = z.infer<typeof PublicInvitationAcceptRequestSchema>;

export const PublicInvitationAcceptResponseSchema = z.object({
  clientAccount: z.object({
    id: z.string(),
    email: z.string().email(),
    role: z.literal("member"),
    cardexId: z.string(),
    status: z.literal("active"),
  }),
  invitation: z.object({
    id: z.string(),
    status: z.literal("accepted"),
    acceptedAt: z.string().datetime(),
    acceptedClientAccountId: z.string(),
    cardexId: z.string(),
  }),
  companyLabel: z.string().min(1),
  emailSent: z.boolean(),
  emailError: z.string().optional(),
});
export type PublicInvitationAcceptResponse = z.infer<typeof PublicInvitationAcceptResponseSchema>;
