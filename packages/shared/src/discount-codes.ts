import { z } from "zod";

import { euroAmountSchema } from "./spaces.js";
import { eurosToCents, centsToEuros } from "./money.js";
import type { ServicePromoEligibility } from "./services.js";

export const DISCOUNT_CODE_KINDS = ["promo", "preferential"] as const;
export const DiscountCodeKindSchema = z.enum(DISCOUNT_CODE_KINDS);
export type DiscountCodeKind = z.infer<typeof DiscountCodeKindSchema>;

export const DISCOUNT_TYPES = ["percentage", "fixed_amount", "buy_one_get_one"] as const;
export const DiscountTypeSchema = z.enum(DISCOUNT_TYPES);
export type DiscountType = z.infer<typeof DiscountTypeSchema>;

export const DISCOUNT_APPLIES_TO = ["order", "space", "service"] as const;
export const DiscountAppliesToSchema = z.enum(DISCOUNT_APPLIES_TO);
export type DiscountAppliesTo = z.infer<typeof DiscountAppliesToSchema>;

export const DISCOUNT_CODE_STATUSES = ["active", "expired", "disabled"] as const;
export const DiscountCodeStatusSchema = z.enum(DISCOUNT_CODE_STATUSES);
export type DiscountCodeStatus = z.infer<typeof DiscountCodeStatusSchema>;

export const DISCOUNT_CODE_DISPLAY_STATUSES = [
  "active",
  "expired",
  "exhausted",
  "disabled",
] as const;
export type DiscountCodeDisplayStatus = (typeof DISCOUNT_CODE_DISPLAY_STATUSES)[number];

export const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export const DiscountPerimeterInputSchema = z.object({
  appliesTo: DiscountAppliesToSchema,
  serviceKeys: z.array(z.string().trim().min(1)).optional(),
});

export const DiscountPerimeterResponseSchema = z.object({
  appliesTo: DiscountAppliesToSchema,
  serviceKeys: z.array(z.string()).optional(),
});

export interface DiscountCodeTargetInput {
  discountType: DiscountType;
  perimeter: z.infer<typeof DiscountPerimeterInputSchema>;
}

export class DiscountCodeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscountCodeValidationError";
  }
}

const discountCodeBaseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .transform((value) => value.toUpperCase())
    .refine((value) => PROMO_CODE_PATTERN.test(value), {
      message: "Code must be 3-32 uppercase letters, digits, _ or -",
    }),
  perimeter: DiscountPerimeterInputSchema,
  stackable: z.boolean().default(false),
  expiresAt: z.string().datetime({ offset: true }),
  maxUses: z.number().int().min(1).optional(),
  status: DiscountCodeStatusSchema.default("active"),
});

function refineDiscountPerimeter<T extends z.ZodTypeAny>(schema: T): T {
  return schema.superRefine((input, context) => {
    const payload = input as DiscountCodeTargetInput;

    try {
      assertDiscountCodeServiceTargets(payload, [], { skipServiceLookup: true });
    } catch (error) {
      if (error instanceof DiscountCodeValidationError) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: error.message,
          path: ["perimeter"],
        });
      }
    }

    if (payload.discountType === "buy_one_get_one" && payload.perimeter.appliesTo !== "service") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le type « 1 acheté = 1 offert » nécessite un périmètre « services spécifiques »",
        path: ["perimeter", "appliesTo"],
      });
    }

    if (payload.perimeter.appliesTo === "order") {
      if (payload.perimeter.serviceKeys?.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Aucun service ne doit être sélectionné pour un périmètre « toute la commande »",
          path: ["perimeter", "serviceKeys"],
        });
      }
    }

    if (payload.perimeter.appliesTo === "service") {
      if (!payload.perimeter.serviceKeys?.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sélectionnez au moins un service",
          path: ["perimeter", "serviceKeys"],
        });
      }
    }

    if (payload.perimeter.appliesTo === "space") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le périmètre « espace » n'est pas disponible pour les codes promo",
        path: ["perimeter", "appliesTo"],
      });
    }
  }) as T;
}

const createDiscountCodeCommonSchema = discountCodeBaseSchema.extend({
  kind: z.literal("promo").default("promo"),
});

export const CreateDiscountCodeRequestSchema = refineDiscountPerimeter(
  z.discriminatedUnion("discountType", [
    createDiscountCodeCommonSchema.extend({
      discountType: z.literal("percentage"),
      valuePercent: z.number().min(0).max(100),
    }),
    createDiscountCodeCommonSchema.extend({
      discountType: z.literal("fixed_amount"),
      valueEuros: euroAmountSchema.refine((value) => value > 0, {
        message: "Fixed amount must be greater than zero",
      }),
    }),
    createDiscountCodeCommonSchema.extend({
      discountType: z.literal("buy_one_get_one"),
    }),
  ]),
);

export const UpdateDiscountCodeRequestSchema = z
  .object({
    code: discountCodeBaseSchema.shape.code.optional(),
    discountType: DiscountTypeSchema.optional(),
    valuePercent: z.number().min(0).max(100).optional(),
    valueEuros: euroAmountSchema.optional(),
    perimeter: DiscountPerimeterInputSchema.optional(),
    stackable: z.boolean().optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    maxUses: z.number().int().min(1).nullable().optional(),
    status: DiscountCodeStatusSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.discountType === "percentage" && input.valuePercent == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "valuePercent is required for percentage discounts",
        path: ["valuePercent"],
      });
    }
    if (input.discountType === "fixed_amount") {
      if (input.valueEuros == null || input.valueEuros <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "valueEuros must be greater than zero for fixed amount discounts",
          path: ["valueEuros"],
        });
      }
    }
    if (input.perimeter) {
      try {
        assertDiscountCodeServiceTargets(
          {
            discountType: input.discountType ?? "percentage",
            perimeter: input.perimeter,
          },
          [],
          { skipServiceLookup: true },
        );
      } catch (error) {
        if (error instanceof DiscountCodeValidationError) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: error.message,
            path: ["perimeter"],
          });
        }
      }
      if (input.discountType === "buy_one_get_one" && input.perimeter.appliesTo !== "service") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Le type « 1 acheté = 1 offert » nécessite un périmètre « services spécifiques »",
          path: ["perimeter", "appliesTo"],
        });
      }
    }
  });

export const DiscountCodeResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  kind: DiscountCodeKindSchema,
  discountType: DiscountTypeSchema,
  value: z.number(),
  valueEuros: z.number().optional(),
  valuePercent: z.number().optional(),
  perimeter: DiscountPerimeterResponseSchema,
  stackable: z.boolean(),
  expiresAt: z.string(),
  maxUses: z.number().int().min(1).optional(),
  usedCount: z.number().int().min(0),
  status: DiscountCodeStatusSchema,
  displayStatus: z.enum(DISCOUNT_CODE_DISPLAY_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DiscountCodesListResponseSchema = z.object({
  discountCodes: z.array(DiscountCodeResponseSchema),
});

export type DiscountPerimeterInput = z.infer<typeof DiscountPerimeterInputSchema>;
export type CreateDiscountCodeRequest = z.infer<typeof CreateDiscountCodeRequestSchema>;
export type UpdateDiscountCodeRequest = z.infer<typeof UpdateDiscountCodeRequestSchema>;
export type DiscountCodeResponse = z.infer<typeof DiscountCodeResponseSchema>;
export type DiscountCodesListResponse = z.infer<typeof DiscountCodesListResponseSchema>;

export function mapFixedDiscountEurosToDb(valueEuros: number): number {
  return eurosToCents(valueEuros);
}

export function mapFixedDiscountDbToEuros(valueCents: number): number {
  return centsToEuros(valueCents);
}

export function mapDiscountValueToDb(input: CreateDiscountCodeRequest): number {
  switch (input.discountType) {
    case "percentage":
      return input.valuePercent;
    case "fixed_amount":
      return mapFixedDiscountEurosToDb(input.valueEuros);
    case "buy_one_get_one":
      return 0;
  }
}

export function computeDiscountCodeDisplayStatus(
  input: {
    status: DiscountCodeStatus;
    expiresAt: Date;
    maxUses?: number;
    usedCount: number;
  },
  now: Date = new Date(),
): DiscountCodeDisplayStatus {
  if (input.status === "disabled") {
    return "disabled";
  }
  if (input.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  if (input.maxUses != null && input.usedCount >= input.maxUses) {
    return "exhausted";
  }
  if (input.status === "active") {
    return "active";
  }
  return "disabled";
}

export function assertDiscountCodeServiceTargets(
  input: DiscountCodeTargetInput,
  services: readonly ServicePromoEligibility[],
  options: { skipServiceLookup?: boolean } = {},
): void {
  const { discountType, perimeter } = input;

  if (perimeter.appliesTo === "space") {
    throw new DiscountCodeValidationError(
      "Les codes promo ne peuvent pas cibler un espace, une salle ou un bureau",
    );
  }

  if (perimeter.appliesTo === "order") {
    if (perimeter.serviceKeys?.length) {
      throw new DiscountCodeValidationError(
        "Aucun service ne doit être ciblé lorsque le périmètre est « toute la commande »",
      );
    }
    if (discountType === "buy_one_get_one") {
      throw new DiscountCodeValidationError(
        "Le type « 1 acheté = 1 offert » nécessite un périmètre « services spécifiques »",
      );
    }
    return;
  }

  if (perimeter.appliesTo !== "service") {
    return;
  }

  const serviceKeys = perimeter.serviceKeys ?? [];
  if (serviceKeys.length === 0) {
    throw new DiscountCodeValidationError("Sélectionnez au moins un service pour ce périmètre");
  }

  if (options.skipServiceLookup) {
    return;
  }

  const serviceMap = new Map(services.map((service) => [service.key, service]));

  for (const key of serviceKeys) {
    const service = serviceMap.get(key);
    if (!service) {
      throw new DiscountCodeValidationError(`Service inconnu : ${key}`);
    }
    if (service.status === "inactive") {
      throw new DiscountCodeValidationError(
        `Le service « ${service.label} » est inactif et ne peut pas être ciblé`,
      );
    }
    if (discountType === "buy_one_get_one" && !service.promoEligible) {
      throw new DiscountCodeValidationError(
        `Le service « ${service.label} » n'est pas éligible aux remises « 1 acheté = 1 offert »`,
      );
    }
  }
}

export interface DiscountCodeDbShape {
  code: string;
  kind: DiscountCodeKind;
  discountType: DiscountType;
  value: number;
  perimeter: {
    appliesTo: string;
    serviceKeys?: string[];
  };
  stackable: boolean;
  expiresAt: Date;
  maxUses?: number;
  usedCount: number;
  status: DiscountCodeStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function mapDiscountCodeToResponse(
  doc: DiscountCodeDbShape & { _id: { toString(): string } },
  now: Date = new Date(),
): DiscountCodeResponse {
  const displayStatus = computeDiscountCodeDisplayStatus(
    {
      status: doc.status,
      expiresAt: doc.expiresAt,
      maxUses: doc.maxUses,
      usedCount: doc.usedCount,
    },
    now,
  );

  return DiscountCodeResponseSchema.parse({
    id: doc._id.toString(),
    code: doc.code,
    kind: doc.kind,
    discountType: doc.discountType,
    value: doc.value,
    valuePercent: doc.discountType === "percentage" ? doc.value : undefined,
    valueEuros:
      doc.discountType === "fixed_amount" ? mapFixedDiscountDbToEuros(doc.value) : undefined,
    perimeter: {
      appliesTo: doc.perimeter.appliesTo,
      serviceKeys: doc.perimeter.serviceKeys,
    },
    stackable: doc.stackable,
    expiresAt: doc.expiresAt.toISOString(),
    maxUses: doc.maxUses,
    usedCount: doc.usedCount,
    status: doc.status,
    displayStatus,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
}
