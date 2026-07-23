import { z } from "zod";

/** Mirrors packages/db CLIENT_ACCOUNT_STATUSES (keep in sync). */
export const ClientAccountStatusSchema = z.enum([
  "active",
  "locked",
  "anonymized",
  "pending_activation",
]);
export type ClientAccountStatus = z.infer<typeof ClientAccountStatusSchema>;

/** Mirrors packages/db CLIENT_ACCOUNT_ROLES (keep in sync). */
export const ClientAccountRoleSchema = z.enum(["owner", "member"]);
export type ClientAccountRole = z.infer<typeof ClientAccountRoleSchema>;

/** Staff deactivate — reason optional. */
export const StaffDeactivateClientAccountRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type StaffDeactivateClientAccountRequest = z.infer<
  typeof StaffDeactivateClientAccountRequestSchema
>;

export const StaffReactivateClientAccountRequestSchema = z.object({}).strict();
export type StaffReactivateClientAccountRequest = z.infer<
  typeof StaffReactivateClientAccountRequestSchema
>;

export const StaffTransferCardexOwnershipRequestSchema = z.object({
  nextClientAccountId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});
export type StaffTransferCardexOwnershipRequest = z.infer<
  typeof StaffTransferCardexOwnershipRequestSchema
>;

export const CLIENT_ACCOUNT_STAFF_ERROR_CODES = {
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
  ACCOUNT_IS_OWNER: "ACCOUNT_IS_OWNER",
  ACCOUNT_LAST_ACTIVE: "ACCOUNT_LAST_ACTIVE",
  ACCOUNT_NOT_LOCKED: "ACCOUNT_NOT_LOCKED",
  ACCOUNT_ALREADY_LOCKED: "ACCOUNT_ALREADY_LOCKED",
  ACCOUNT_ANONYMIZED: "ACCOUNT_ANONYMIZED",
  CARDEX_NOT_FOUND: "CARDEX_NOT_FOUND",
  TRANSFER_TARGET_INVALID: "TRANSFER_TARGET_INVALID",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_ID: "INVALID_ID",
} as const;

export type ClientAccountStaffErrorCode =
  (typeof CLIENT_ACCOUNT_STAFF_ERROR_CODES)[keyof typeof CLIENT_ACCOUNT_STAFF_ERROR_CODES];

/** Canonical French messages for staff ClientAccount mutations (keep in sync with API). */
export const CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES = {
  ACCOUNT_NOT_FOUND: "Compte client introuvable.",
  ACCOUNT_IS_OWNER:
    "Impossible de désactiver le propriétaire du cardex. Transférez d'abord la propriété à un autre compte actif.",
  ACCOUNT_LAST_ACTIVE: "Impossible de désactiver le dernier compte actif de ce cardex.",
  ACCOUNT_ALREADY_LOCKED: "Ce compte est déjà désactivé.",
  ACCOUNT_NOT_LOCKED: "Ce compte n'est pas désactivé — réactivation impossible.",
  ACCOUNT_ANONYMIZED: "Ce compte anonymisé ne peut pas être modifié.",
  CARDEX_NOT_FOUND: "Cardex introuvable.",
  TRANSFER_TARGET_OTHER_CARDEX: "Le compte cible n'appartient pas à ce cardex.",
  TRANSFER_TARGET_NOT_ACTIVE: "Le compte cible doit être actif.",
  TRANSFER_TARGET_IS_OWNER: "Le compte cible est déjà le propriétaire de ce cardex.",
  TRANSFER_TARGET_NOT_FOUND: "Compte cible introuvable.",
  INVALID_ID: "Identifiant invalide.",
} as const;

export const StaffClientAccountSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: ClientAccountRoleSchema,
  status: ClientAccountStatusSchema,
  cardexId: z.string().optional(),
  lockedAt: z.string().datetime().optional(),
  lockedByStaffProfileId: z.string().optional(),
  lockReason: z.string().optional(),
  unlockedAt: z.string().datetime().optional(),
  unlockedByStaffProfileId: z.string().optional(),
});
export type StaffClientAccount = z.infer<typeof StaffClientAccountSchema>;

export const StaffTransferCardexOwnershipResultSchema = z.object({
  cardexId: z.string(),
  previousOwner: StaffClientAccountSchema,
  nextOwner: StaffClientAccountSchema,
});
export type StaffTransferCardexOwnershipResult = z.infer<
  typeof StaffTransferCardexOwnershipResultSchema
>;

/** Message shown on vitrine when a locked account tries to log in / verify. */
export const CLIENT_ACCOUNT_LOCKED_USER_MESSAGE =
  "Ce compte a été désactivé. Contactez votre espace de coworking." as const;

/**
 * Message shown when status is pending_activation (staff-accept bootstrap).
 * MUST stay distinct from CLIENT_ACCOUNT_LOCKED_USER_MESSAGE.
 */
export const CLIENT_ACCOUNT_PENDING_ACTIVATION_USER_MESSAGE =
  "Ce compte n'est pas encore activé. Consultez votre email pour définir votre mot de passe." as const;

export const CLIENT_ACCOUNT_AUTH_ERROR_CODES = {
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  /** Staff-accept bootstrap — password not set yet. Never collapse with ACCOUNT_LOCKED. */
  ACCOUNT_PENDING_ACTIVATION: "ACCOUNT_PENDING_ACTIVATION",
} as const;

export type ClientAccountAuthErrorCode =
  (typeof CLIENT_ACCOUNT_AUTH_ERROR_CODES)[keyof typeof CLIENT_ACCOUNT_AUTH_ERROR_CODES];
