import { z } from "zod";

/** Mirrors packages/db CLIENT_ACCOUNT_STATUSES (keep in sync). */
export const ClientAccountStatusSchema = z.enum(["active", "locked", "anonymized"]);
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

/** Message shown on vitrine when a locked account tries to log in / verify. */
export const CLIENT_ACCOUNT_LOCKED_USER_MESSAGE =
  "Ce compte a été désactivé. Contactez votre espace de coworking." as const;

export const CLIENT_ACCOUNT_AUTH_ERROR_CODES = {
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
} as const;

export type ClientAccountAuthErrorCode =
  (typeof CLIENT_ACCOUNT_AUTH_ERROR_CODES)[keyof typeof CLIENT_ACCOUNT_AUTH_ERROR_CODES];
