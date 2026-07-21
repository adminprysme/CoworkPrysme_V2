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
