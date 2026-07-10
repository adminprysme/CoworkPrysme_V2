import { z } from "zod";

import { eurosToCents, centsToEuros } from "./money.js";
import { euroAmountSchema } from "./spaces.js";
import { slugifyServiceKey, resolveUniqueSlugFromSet } from "./seo.js";

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

export const CreateServiceRequestSchema = z.object({
  label: z.string().trim().min(1).max(SERVICE_LABEL_MAX_LENGTH),
  description: ServiceDescriptionSchema,
  priceEurosHT: euroAmountSchema,
  vatRate: z.number().min(0).default(DEFAULT_SERVICE_VAT_RATE),
  promoEligible: z.boolean().default(false),
  status: ServiceStatusSchema.default("active"),
});

export const UpdateServiceRequestSchema = CreateServiceRequestSchema.partial();

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
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ServicesListResponseSchema = z.object({
  services: z.array(ServiceResponseSchema),
});

export type CreateServiceRequest = z.infer<typeof CreateServiceRequestSchema>;
export type UpdateServiceRequest = z.infer<typeof UpdateServiceRequestSchema>;
export type ServiceResponse = z.infer<typeof ServiceResponseSchema>;
export type ServicesListResponse = z.infer<typeof ServicesListResponseSchema>;

export interface ServiceDbShape {
  key: string;
  label: string;
  description?: string;
  priceHT: number;
  vatRate: number;
  promoEligible: boolean;
  status: ServiceStatus;
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

export function mapCreateServiceRequestToDb(
  input: CreateServiceRequest,
  key: string,
): Omit<ServiceDbShape, "createdAt" | "updatedAt"> {
  return {
    key,
    label: input.label.trim(),
    description: normalizeServiceDescription(input.description),
    priceHT: mapServicePriceEurosToDb(input.priceEurosHT),
    vatRate: input.vatRate,
    promoEligible: input.promoEligible,
    status: input.status,
  };
}

export function mapServiceToResponse(
  doc: ServiceDbShape & { _id: { toString(): string } },
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
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
}
