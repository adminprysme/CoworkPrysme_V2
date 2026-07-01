import { z } from "zod";

export const AuthModeSchema = z.enum(["local", "sso"]);
export type AuthMode = z.infer<typeof AuthModeSchema>;

export const AuthSourceSchema = z.enum(["local", "sso"]);
export type AuthSource = z.infer<typeof AuthSourceSchema>;

export const StaffRoleSchema = z.enum(["manager", "admin"]);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const StaffPermissionsSchema = z.object({
  planning: z.boolean(),
  billing: z.boolean(),
  clients: z.boolean(),
  stats: z.boolean(),
  spaces: z.boolean(),
  promo: z.boolean(),
});
export type StaffPermissions = z.infer<typeof StaffPermissionsSchema>;

export const StaffScopeSchema = z.object({
  buildingIds: z.array(z.string()),
  spaceTypes: z.array(z.string()),
});
export type StaffScope = z.infer<typeof StaffScopeSchema>;

export const StaffProfilePublicSchema = z.object({
  id: z.string(),
  prysmAppUserId: z.string(),
  displayName: z.string(),
  email: z.string(),
  role: StaffRoleSchema,
  permissions: StaffPermissionsSchema,
  scope: StaffScopeSchema,
  status: z.enum(["active", "revoked"]),
});
export type StaffProfilePublic = z.infer<typeof StaffProfilePublicSchema>;

export const PrysmaEnrichmentSchema = z.object({
  photo: z.string().optional(),
  position: z.string().optional(),
  service: z.string().optional(),
  office: z.string().optional(),
});
export type PrysmaEnrichment = z.infer<typeof PrysmaEnrichmentSchema>;

export const AuthMeResponseSchema = z.object({
  profile: StaffProfilePublicSchema,
  authSource: AuthSourceSchema,
  enrichment: PrysmaEnrichmentSchema.optional(),
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;

export const LocalLoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type LocalLoginRequest = z.infer<typeof LocalLoginRequestSchema>;

export const SsoLoginRequestSchema = z.object({
  sso_token: z.string().min(1),
});
export type SsoLoginRequest = z.infer<typeof SsoLoginRequestSchema>;

export const LogoutResponseSchema = z.object({
  redirectUrl: z.string(),
});
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;

export const CentraleValidatedUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  company_id: z.string().optional(),
});
export type CentraleValidatedUser = z.infer<typeof CentraleValidatedUserSchema>;

export const CentraleValidateSsoResponseSchema = z.object({
  valid: z.literal(true),
  user: CentraleValidatedUserSchema,
});
export type CentraleValidateSsoResponse = z.infer<typeof CentraleValidateSsoResponseSchema>;

export const ADMIN_BOOTSTRAP_USERNAME = "paul.thomas" as const;

export const GESTION_SESSION_COOKIE = "gestion_sid" as const;

export const ALL_STAFF_PERMISSIONS: StaffPermissions = {
  planning: true,
  billing: true,
  clients: true,
  stats: true,
  spaces: true,
  promo: true,
};

export const NO_STAFF_PERMISSIONS: StaffPermissions = {
  planning: false,
  billing: false,
  clients: false,
  stats: false,
  spaces: false,
  promo: false,
};
