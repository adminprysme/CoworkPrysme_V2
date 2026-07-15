import { z } from "zod";

import { eurosToCents, centsToEuros } from "./money.js";
import { euroAmountSchema } from "./spaces.js";
import { slugifyServiceKey, resolveUniqueSlugFromSet } from "./seo.js";
import {
  ServiceBuildingIdsSchema,
  assertServiceAvailabilityShape,
  normalizeServiceBuildingIds,
  ServiceAccessError,
  type ServiceAccessProfile,
  type ServiceRecordForAccess,
} from "./service-access.js";
import {
  ServiceCustomQuestionsInputSchema,
  ServiceCustomQuestionsSchema,
  mapServiceCustomQuestionsToResponse,
  normalizeServiceCustomQuestions,
  type ServiceCustomQuestionDbShape,
  type ServiceCustomQuestionInput,
} from "./service-custom-questions.js";
import {
  ServicePhotoResponseSchema,
  mediaPathFromStorageKey,
  type ServicePhotoResponse,
} from "./uploads.js";

export {
  MAX_SERVICE_CUSTOM_QUESTIONS,
  SERVICE_CUSTOM_QUESTION_LABEL_MAX_LENGTH,
  SERVICE_CUSTOM_QUESTION_SELECT_MIN_OPTIONS,
  SERVICE_CUSTOM_QUESTION_TYPE_LABELS,
  SERVICE_CUSTOM_QUESTION_TYPES,
  ServiceCustomAnswerSchema,
  ServiceCustomAnswerValueSchemas,
  ServiceCustomQuestionInputSchema,
  ServiceCustomQuestionSchema,
  ServiceCustomQuestionTypeSchema,
  ServiceCustomQuestionsInputSchema,
  ServiceCustomQuestionsSchema,
  ensureServiceCustomQuestionIds,
  mapServiceCustomQuestionsToResponse,
  normalizeServiceCustomQuestions,
  type ServiceCustomAnswer,
  type ServiceCustomQuestion,
  type ServiceCustomQuestionDbShape,
  type ServiceCustomQuestionInput,
  type ServiceCustomQuestionType,
  type ServiceCustomQuestions,
  type ServiceCustomQuestionsInput,
} from "./service-custom-questions.js";

export {
  ServiceAccessError,
  ServiceAvailabilityFieldsSchema,
  ServiceBuildingIdsSchema,
  assertBuildingIdsInManagerScope,
  assertServiceAvailabilityShape,
  assertServiceContentUpdateAllowed,
  assertServiceCreateAllowed,
  assertServiceDeleteAllowed,
  assertServicePhotoMutationAllowed,
  getFrozenServiceBuildingIds,
  getServiceEditMode,
  getServiceListFilter,
  hasGlobalBuildingScope,
  isBuildingIdInManagerScope,
  isServiceAdmin,
  mergeManagerBuildingIds,
  normalizeServiceBuildingIds,
  resolveServiceBuildingIdsForUpdate,
  serviceHasBuildingOverlap,
  type ServiceAccessProfile,
  type ServiceAvailabilityFields,
  type ServiceAvailabilityShape,
  type ServiceEditMode,
  type ServiceRecordForAccess,
  type ServiceStaffRole,
} from "./service-access.js";

export {
  ServicePhotoResponseSchema,
  mediaPathFromStorageKey,
  type ServicePhotoResponse,
} from "./uploads.js";

export const SERVICE_STATUSES = ["active", "inactive"] as const;
export const ServiceStatusSchema = z.enum(SERVICE_STATUSES);
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

export const DEFAULT_SERVICE_VAT_RATE = 20;
export const SERVICE_DESCRIPTION_MAX_LENGTH = 500;
export const SERVICE_LABEL_MAX_LENGTH = 120;

export const ServiceDescriptionSchema = z
  .string()
  .trim()
  .max(SERVICE_DESCRIPTION_MAX_LENGTH)
  .optional();

export const ServiceBuildingSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
});

const serviceAvailabilityInputSchema = z.object({
  isGlobal: z.boolean().default(true),
  buildingIds: ServiceBuildingIdsSchema.default([]),
});

const serviceRequestFieldsSchema = z
  .object({
    label: z.string().trim().min(1).max(SERVICE_LABEL_MAX_LENGTH),
    description: ServiceDescriptionSchema,
    priceEurosHT: euroAmountSchema,
    vatRate: z.number().min(0).default(DEFAULT_SERVICE_VAT_RATE),
    promoEligible: z.boolean().default(false),
    status: ServiceStatusSchema.default("active"),
    customQuestions: ServiceCustomQuestionsInputSchema,
  })
  .merge(serviceAvailabilityInputSchema);

export const CreateServiceRequestSchema = serviceRequestFieldsSchema.superRefine(
  (input, context) => {
    try {
      assertServiceAvailabilityShape(input);
    } catch (error) {
      if (error instanceof ServiceAccessError) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: error.message,
          path: ["buildingIds"],
        });
      }
    }
  },
);

export const UpdateServiceRequestSchema = z.object({
  label: z.string().trim().min(1).max(SERVICE_LABEL_MAX_LENGTH).optional(),
  description: ServiceDescriptionSchema,
  priceEurosHT: euroAmountSchema.optional(),
  vatRate: z.number().min(0).optional(),
  promoEligible: z.boolean().optional(),
  status: ServiceStatusSchema.optional(),
  customQuestions: ServiceCustomQuestionsInputSchema.optional(),
  isGlobal: z.boolean().optional(),
  buildingIds: ServiceBuildingIdsSchema.optional(),
});

export const ServiceResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  priceEurosHT: z.number(),
  priceHTCents: z.number().int().min(0),
  vatRate: z.number().min(0),
  promoEligible: z.boolean(),
  status: ServiceStatusSchema,
  customQuestions: ServiceCustomQuestionsSchema,
  photo: ServicePhotoResponseSchema.optional(),
  isGlobal: z.boolean(),
  buildingIds: z.array(z.string()),
  buildings: z.array(ServiceBuildingSummarySchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ServicesListResponseSchema = z.object({
  services: z.array(ServiceResponseSchema),
});

export type CreateServiceRequest = Omit<
  z.infer<typeof CreateServiceRequestSchema>,
  "customQuestions"
> & {
  customQuestions?: ServiceCustomQuestionInput[];
};
export type UpdateServiceRequest = Partial<CreateServiceRequest>;
export type ServiceResponse = z.infer<typeof ServiceResponseSchema>;
export type ServicesListResponse = z.infer<typeof ServicesListResponseSchema>;
export type ServiceBuildingSummary = z.infer<typeof ServiceBuildingSummarySchema>;

export interface ServicePhotoDbShape {
  storageKey: string;
  alt?: string;
}

export interface ServiceDbShape {
  key: string;
  label: string;
  description?: string;
  priceHT: number;
  vatRate: number;
  promoEligible: boolean;
  status: ServiceStatus;
  customQuestions: ServiceCustomQuestionDbShape[];
  photo?: ServicePhotoDbShape;
  isGlobal: boolean;
  buildingIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ServicePromoEligibility {
  key: string;
  label: string;
  promoEligible: boolean;
  status?: ServiceStatus;
}

export function baseKeyForServiceLabel(label: string): string {
  return slugifyServiceKey(label);
}

export function resolveUniqueServiceKey(baseKey: string, takenKeys: Set<string>): string {
  return resolveUniqueSlugFromSet(baseKey, takenKeys);
}

export function mapServicePriceEurosToDb(priceEurosHT: number): number {
  return eurosToCents(priceEurosHT);
}

export function mapServicePriceDbToEuros(priceHTCents: number): number {
  return centsToEuros(priceHTCents);
}

export function normalizeServiceDescription(description?: string): string | undefined {
  const trimmed = description?.trim();
  return trimmed ? trimmed : undefined;
}

export function mapServicePhotoToResponse(
  photo?: ServicePhotoDbShape,
): ServicePhotoResponse | undefined {
  if (!photo?.storageKey) {
    return undefined;
  }

  return ServicePhotoResponseSchema.parse({
    storageKey: photo.storageKey,
    url: mediaPathFromStorageKey(photo.storageKey),
    alt: photo.alt?.trim() || undefined,
  });
}

export function mapCreateServiceRequestToDb(
  input: CreateServiceRequest,
  key: string,
): Omit<ServiceDbShape, "createdAt" | "updatedAt"> {
  const buildingIds = normalizeServiceBuildingIds(input.buildingIds ?? []);

  return {
    key,
    label: input.label.trim(),
    description: normalizeServiceDescription(input.description),
    priceHT: mapServicePriceEurosToDb(input.priceEurosHT),
    vatRate: input.vatRate,
    promoEligible: input.promoEligible,
    status: input.status,
    customQuestions: normalizeServiceCustomQuestions(input.customQuestions ?? []),
    isGlobal: input.isGlobal ?? true,
    buildingIds,
  };
}

export function mapServiceToResponse(
  doc: ServiceDbShape & { _id: { toString(): string } },
  options?: { buildings?: ServiceBuildingSummary[] },
): ServiceResponse {
  return ServiceResponseSchema.parse({
    id: doc._id.toString(),
    key: doc.key,
    label: doc.label,
    description: normalizeServiceDescription(doc.description),
    priceEurosHT: mapServicePriceDbToEuros(doc.priceHT),
    priceHTCents: doc.priceHT,
    vatRate: doc.vatRate,
    promoEligible: doc.promoEligible,
    status: doc.status,
    customQuestions: mapServiceCustomQuestionsToResponse(doc.customQuestions),
    photo: mapServicePhotoToResponse(doc.photo),
    isGlobal: doc.isGlobal ?? true,
    buildingIds: normalizeServiceBuildingIds(doc.buildingIds ?? []),
    buildings: options?.buildings,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
}

export function toServiceRecordForAccess(
  doc: Pick<ServiceDbShape, "isGlobal" | "buildingIds"> & { _id: { toString(): string } },
): ServiceRecordForAccess {
  return {
    id: doc._id.toString(),
    isGlobal: doc.isGlobal ?? true,
    buildingIds: normalizeServiceBuildingIds(doc.buildingIds ?? []),
  };
}

export function toServiceAccessProfile(profile: {
  role: "admin" | "manager" | "none";
  scope: { buildingIds: Array<{ toString(): string }> };
}): ServiceAccessProfile {
  return {
    role: profile.role === "admin" ? "admin" : "manager",
    scopeBuildingIds: profile.scope.buildingIds.map((id) => id.toString()),
  };
}
