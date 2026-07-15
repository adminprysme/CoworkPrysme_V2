import { z } from "zod";

export const SERVICE_OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export const ServiceBuildingIdsSchema = z.array(
  z.string().trim().regex(SERVICE_OBJECT_ID_PATTERN, "Identifiant de bâtiment invalide"),
);

export type ServiceStaffRole = "admin" | "manager";

export interface ServiceAccessProfile {
  role: ServiceStaffRole;
  scopeBuildingIds: string[];
}

export interface ServiceAvailabilityShape {
  isGlobal: boolean;
  buildingIds: string[];
}

export interface ServiceRecordForAccess extends ServiceAvailabilityShape {
  id: string;
}

export class ServiceAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceAccessError";
  }
}

const SERVICE_PRICE_ONLY_UPDATE_KEYS = new Set(["priceEurosHT", "vatRate"]);

const SERVICE_CONTENT_UPDATE_KEYS = new Set([
  "label",
  "description",
  "priceEurosHT",
  "vatRate",
  "promoEligible",
  "status",
  "customQuestions",
  "isGlobal",
  "buildingIds",
]);

export function isServiceAdmin(profile: ServiceAccessProfile): boolean {
  return profile.role === "admin";
}

export function hasGlobalBuildingScope(profile: ServiceAccessProfile): boolean {
  return profile.scopeBuildingIds.length === 0;
}

export function normalizeServiceBuildingIds(buildingIds: string[]): string[] {
  return [...new Set(buildingIds.map((id) => id.toLowerCase()))];
}

export function assertServiceAvailabilityShape(input: ServiceAvailabilityShape): void {
  const buildingIds = normalizeServiceBuildingIds(input.buildingIds);

  if (input.isGlobal && buildingIds.length > 0) {
    throw new ServiceAccessError(
      "Un service global ne peut pas être rattaché à des bâtiments spécifiques",
    );
  }

  if (!input.isGlobal && buildingIds.length === 0) {
    throw new ServiceAccessError("Un service non global doit être rattaché à au moins un bâtiment");
  }
}

export function isBuildingIdInManagerScope(
  buildingId: string,
  profile: ServiceAccessProfile,
): boolean {
  if (isServiceAdmin(profile) || hasGlobalBuildingScope(profile)) {
    return true;
  }

  const normalized = buildingId.toLowerCase();
  return profile.scopeBuildingIds.some((id) => id.toLowerCase() === normalized);
}

export function assertBuildingIdsInManagerScope(
  buildingIds: string[],
  profile: ServiceAccessProfile,
): void {
  if (isServiceAdmin(profile) || hasGlobalBuildingScope(profile)) {
    return;
  }

  for (const buildingId of buildingIds) {
    if (!isBuildingIdInManagerScope(buildingId, profile)) {
      throw new ServiceAccessError(
        "Vous ne pouvez pas rattacher ce service à un bâtiment hors de votre périmètre",
      );
    }
  }
}

export function assertServiceCreateAllowed(
  profile: ServiceAccessProfile,
  input: ServiceAvailabilityShape,
): void {
  assertServiceAvailabilityShape(input);

  if (!isServiceAdmin(profile) && input.isGlobal) {
    throw new ServiceAccessError("Seul un administrateur peut créer un service global");
  }

  assertBuildingIdsInManagerScope(input.buildingIds, profile);
}

export type ServiceEditMode = "all" | "price_only" | "none";

export function getServiceEditMode(
  profile: ServiceAccessProfile,
  service: ServiceRecordForAccess,
): ServiceEditMode {
  if (isServiceAdmin(profile)) {
    return "all";
  }

  if (service.isGlobal) {
    return "price_only";
  }

  if (hasGlobalBuildingScope(profile)) {
    return "all";
  }

  const serviceBuildingIds = normalizeServiceBuildingIds(service.buildingIds);
  const hasOverlap = serviceBuildingIds.some((id) => isBuildingIdInManagerScope(id, profile));
  return hasOverlap ? "all" : "none";
}

export function assertServiceContentUpdateAllowed(
  profile: ServiceAccessProfile,
  service: ServiceRecordForAccess,
  updateKeys: string[],
): void {
  const mode = getServiceEditMode(profile, service);

  if (mode === "none") {
    throw new ServiceAccessError("Vous n'avez pas accès à ce service");
  }

  const contentKeys = updateKeys.filter((key) => SERVICE_CONTENT_UPDATE_KEYS.has(key));
  if (contentKeys.length === 0) {
    return;
  }

  if (mode === "price_only") {
    const forbidden = contentKeys.filter((key) => !SERVICE_PRICE_ONLY_UPDATE_KEYS.has(key));
    if (forbidden.length > 0) {
      throw new ServiceAccessError("Ce service est global — seul le prix est modifiable");
    }
  }
}

export function assertServicePhotoMutationAllowed(
  profile: ServiceAccessProfile,
  service: ServiceRecordForAccess,
): void {
  const mode = getServiceEditMode(profile, service);
  if (mode !== "all") {
    if (mode === "price_only") {
      throw new ServiceAccessError("Ce service est global — seul le prix est modifiable");
    }
    throw new ServiceAccessError("Vous n'avez pas accès à ce service");
  }
}

export function assertServiceDeleteAllowed(profile: ServiceAccessProfile): void {
  if (!isServiceAdmin(profile)) {
    throw new ServiceAccessError("Seul un administrateur peut supprimer un service");
  }
}

export function mergeManagerBuildingIds(
  existingBuildingIds: string[],
  requestedBuildingIds: string[],
  profile: ServiceAccessProfile,
): string[] {
  const existing = normalizeServiceBuildingIds(existingBuildingIds);
  const requested = normalizeServiceBuildingIds(requestedBuildingIds);

  if (isServiceAdmin(profile) || hasGlobalBuildingScope(profile)) {
    return requested;
  }

  const scopeSet = new Set(profile.scopeBuildingIds.map((id) => id.toLowerCase()));
  const frozen = existing.filter((id) => !scopeSet.has(id));

  for (const buildingId of frozen) {
    if (!requested.includes(buildingId)) {
      throw new ServiceAccessError(
        "Vous ne pouvez pas retirer un bâtiment hors de votre périmètre de ce service",
      );
    }
  }

  for (const buildingId of requested) {
    if (!scopeSet.has(buildingId) && !frozen.includes(buildingId)) {
      throw new ServiceAccessError(
        "Vous ne pouvez pas rattacher ce service à un bâtiment hors de votre périmètre",
      );
    }
  }

  const editable = requested.filter((id) => scopeSet.has(id));
  return [...new Set([...frozen, ...editable])];
}

export function resolveServiceBuildingIdsForUpdate(
  profile: ServiceAccessProfile,
  existing: ServiceAvailabilityShape,
  requestedBuildingIds: string[] | undefined,
  requestedIsGlobal: boolean | undefined,
): { isGlobal: boolean; buildingIds: string[] } {
  const nextIsGlobal = requestedIsGlobal ?? existing.isGlobal;
  const nextBuildingIds =
    requestedBuildingIds !== undefined
      ? mergeManagerBuildingIds(existing.buildingIds, requestedBuildingIds, profile)
      : existing.buildingIds;

  const resolved = { isGlobal: nextIsGlobal, buildingIds: nextBuildingIds };
  assertServiceAvailabilityShape(resolved);
  assertBuildingIdsInManagerScope(resolved.buildingIds, profile);
  return resolved;
}

export function getServiceListFilter(profile: ServiceAccessProfile): Record<string, unknown> {
  if (isServiceAdmin(profile) || hasGlobalBuildingScope(profile)) {
    return {};
  }

  const scopedIds = normalizeServiceBuildingIds(profile.scopeBuildingIds);
  return {
    $or: [{ isGlobal: true }, { buildingIds: { $in: scopedIds } }],
  };
}

export function serviceHasBuildingOverlap(
  service: ServiceAvailabilityShape,
  profile: ServiceAccessProfile,
): boolean {
  if (service.isGlobal || hasGlobalBuildingScope(profile)) {
    return true;
  }

  const serviceIds = new Set(normalizeServiceBuildingIds(service.buildingIds));
  return profile.scopeBuildingIds.some((id) => serviceIds.has(id.toLowerCase()));
}

export function getFrozenServiceBuildingIds(
  service: ServiceAvailabilityShape,
  profile: ServiceAccessProfile,
): string[] {
  if (isServiceAdmin(profile) || hasGlobalBuildingScope(profile) || service.isGlobal) {
    return [];
  }

  const scopeSet = new Set(profile.scopeBuildingIds.map((id) => id.toLowerCase()));
  return normalizeServiceBuildingIds(service.buildingIds).filter((id) => !scopeSet.has(id));
}

export const ServiceAvailabilityFieldsSchema = z
  .object({
    isGlobal: z.boolean().default(true),
    buildingIds: ServiceBuildingIdsSchema.default([]),
  })
  .superRefine((input, context) => {
    try {
      assertServiceAvailabilityShape(input);
    } catch (error) {
      if (error instanceof ServiceAccessError) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: error.message,
          path: input.isGlobal ? ["buildingIds"] : ["buildingIds"],
        });
      }
    }
  });

export type ServiceAvailabilityFields = z.infer<typeof ServiceAvailabilityFieldsSchema>;
