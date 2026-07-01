import { z } from "zod";

import { PermissionsStaffRoleSchema } from "./auth.js";

const optionalString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => value ?? undefined);

export const PrysmaCompanyOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type PrysmaCompanyOption = z.infer<typeof PrysmaCompanyOptionSchema>;

export const PrysmaSecteurOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  companyId: z.string(),
});
export type PrysmaSecteurOption = z.infer<typeof PrysmaSecteurOptionSchema>;

export const PermissionsUserRowSchema = z.object({
  id: z.string(),
  photo: optionalString,
  displayName: z.string(),
  companyId: optionalString,
  companyName: optionalString,
  position: optionalString,
  role: PermissionsStaffRoleSchema,
});
export type PermissionsUserRow = z.infer<typeof PermissionsUserRowSchema>;

export const PERMISSIONS_PAGE_SIZES = [25, 50, 100] as const;
export const PermissionsPageSizeSchema = z.union([z.literal(25), z.literal(50), z.literal(100)]);
export type PermissionsPageSize = z.infer<typeof PermissionsPageSizeSchema>;

export const PermissionsPaginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: PermissionsPageSizeSchema,
  total: z.number().int().min(0),
  totalPages: z.number().int().min(1),
});
export type PermissionsPagination = z.infer<typeof PermissionsPaginationSchema>;

export const PermissionsUsersResponseSchema = z.object({
  users: z.array(PermissionsUserRowSchema),
  pagination: PermissionsPaginationSchema,
});
export type PermissionsUsersResponse = z.infer<typeof PermissionsUsersResponseSchema>;

export const PermissionsCompaniesResponseSchema = z.object({
  companies: z.array(PrysmaCompanyOptionSchema),
});
export type PermissionsCompaniesResponse = z.infer<typeof PermissionsCompaniesResponseSchema>;

export const PermissionsSecteursResponseSchema = z.object({
  secteurs: z.array(PrysmaSecteurOptionSchema),
});
export type PermissionsSecteursResponse = z.infer<typeof PermissionsSecteursResponseSchema>;
