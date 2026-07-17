import { z } from "zod";

import {
  BookingPhase1DurationClassSchema,
  BookingPriceServiceInputSchema,
  isoDateTimeSchema,
} from "./booking.js";

/** Privacy policy version stamped on new client account consent records. */
export const PRIVACY_POLICY_VERSION = "2026-07-09";

export const BOOKING_CONFIRM_ERROR_CODES = {
  LOCK_EXPIRED: "LOCK_EXPIRED",
  LOCK_ALREADY_CONSUMED: "LOCK_ALREADY_CONSUMED",
  LOCK_MISMATCH: "LOCK_MISMATCH",
  SLOT_OVERLAP: "SLOT_OVERLAP",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_ALREADY_REGISTERED: "EMAIL_ALREADY_REGISTERED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BANK_TRANSFER_NOT_ELIGIBLE: "BANK_TRANSFER_NOT_ELIGIBLE",
  BANK_TRANSFER_NOT_CONFIGURED: "BANK_TRANSFER_NOT_CONFIGURED",
} as const;

export type BookingConfirmErrorCode =
  (typeof BOOKING_CONFIRM_ERROR_CODES)[keyof typeof BOOKING_CONFIRM_ERROR_CODES];

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{24}$/i, "Identifiant invalide");

export const BookingAccountModeSchema = z.enum(["new", "existing"]);
export type BookingAccountMode = z.infer<typeof BookingAccountModeSchema>;

/** Client payment choice in the booking tunnel (invoice document type remains separate). */
export const BookingPaymentMethodSchema = z.enum(["card", "bank_transfer"]);
export type BookingPaymentMethod = z.infer<typeof BookingPaymentMethodSchema>;

export const BankTransferInstructionsSchema = z.object({
  iban: z.string().min(1),
  bic: z.string().min(1),
  accountHolder: z.string().min(1),
  bankName: z.string().optional(),
  transferLabel: z.string().min(1),
  amountCents: z.number().int().positive(),
  expiresAt: z.string().datetime(),
});

export type BankTransferInstructions = z.infer<typeof BankTransferInstructionsSchema>;

export const BookingPaymentMethodsResponseSchema = z.object({
  paymentMethods: z.array(BookingPaymentMethodSchema),
  bankTransferAvailable: z.boolean(),
  minLeadDays: z.number().int().nonnegative(),
});

export type BookingPaymentMethodsResponse = z.infer<typeof BookingPaymentMethodsResponseSchema>;

export const BookingCardexIdentityInputSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis"),
  lastName: z.string().trim().min(1, "Le nom est requis"),
  phone: z.string().trim().min(1).optional(),
});

export type BookingCardexIdentityInput = z.infer<typeof BookingCardexIdentityInputSchema>;

export const BookingClientKindSchema = z.enum(["individual", "company"]);
export type BookingClientKind = z.infer<typeof BookingClientKindSchema>;

export const BookingAddressInputSchema = z.object({
  street: z.string().trim().min(1, "L'adresse est requise"),
  zip: z.string().trim().min(1, "Le code postal est requis"),
  city: z.string().trim().min(1, "La ville est requise"),
  country: z.string().trim().min(1).default("FR"),
});

export type BookingAddressInput = z.infer<typeof BookingAddressInputSchema>;

export const BookingCompanyInputSchema = z.object({
  legalName: z.string().trim().min(1, "La raison sociale est requise"),
  siret: z
    .string({ error: "Le SIRET est requis" })
    .trim()
    .min(1, "Le SIRET est requis")
    .transform((value) => value.replaceAll(/\s/g, ""))
    .refine((value) => /^\d{14}$/.test(value), {
      message: "Le SIRET doit contenir exactement 14 chiffres",
    }),
  vatNumber: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }
      const normalized = value.replaceAll(/\s/g, "").toUpperCase();
      return normalized === "" ? undefined : normalized;
    }),
  billingAddress: BookingAddressInputSchema,
});

export type BookingCompanyInput = z.infer<typeof BookingCompanyInputSchema>;

export const BookingCheckEmailRequestSchema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
});

export const BookingCheckEmailResponseSchema = z.object({
  exists: z.boolean(),
});

export const BookingVerifyAccountRequestSchema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
  password: z.string().min(8, "Mot de passe invalide"),
});

export const BookingVerifyAccountResponseSchema = z.object({
  valid: z.literal(true),
});

export const BookingConfirmRequestSchema = z
  .object({
    lockId: objectIdSchema,
    sessionId: z.string().trim().min(8).max(128),
    spaceId: objectIdSchema,
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    durationClass: BookingPhase1DurationClassSchema,
    partySize: z.number().int().min(1),
    services: z.array(BookingPriceServiceInputSchema).default([]),
    discountCode: z.string().trim().min(1).optional(),
    accountMode: BookingAccountModeSchema,
    email: z.string().trim().email("Adresse email invalide"),
    password: z.string().min(8, "Mot de passe invalide"),
    identity: BookingCardexIdentityInputSchema.optional(),
    /** Required for new accounts — particulier vs professionnel. */
    clientKind: BookingClientKindSchema.optional(),
    /** Postal address for particuliers (new individual accounts). */
    address: BookingAddressInputSchema.optional(),
    /** Company + billing address for professionnels (new company accounts). */
    company: BookingCompanyInputSchema.optional(),
    privacyPolicyAccepted: z.boolean().optional(),
    marketingCommunicationsAccepted: z.boolean().optional(),
    cgvAccepted: z.literal(true, { message: "L'acceptation des CGV est obligatoire" }),
    withdrawalAcknowledged: z.literal(true, {
      message: "La mention relative au droit de rétractation est obligatoire",
    }),
    paymentMethod: BookingPaymentMethodSchema,
  })
  .superRefine((value, context) => {
    const startAt = new Date(value.startAt);
    const endAt = new Date(value.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date range" });
      return;
    }
    if (endAt <= startAt) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "endAt must be after startAt" });
    }

    if (value.accountMode === "new") {
      if (!value.identity) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["identity"],
          message: "Le prénom et le nom sont requis pour créer un compte",
        });
      }
      if (!value.privacyPolicyAccepted) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["privacyPolicyAccepted"],
          message: "Le consentement à la politique de confidentialité est obligatoire",
        });
      }
      if (!value.clientKind) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["clientKind"],
          message: "Choisissez particulier ou professionnel",
        });
      } else if (value.clientKind === "individual") {
        if (!value.address) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["address"],
            message: "L'adresse est requise pour un compte particulier",
          });
        }
      } else if (!value.company) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["company"],
          message: "Les informations société sont requises pour un compte professionnel",
        });
      }
    }
  });

export const BookingConfirmResponseSchema = z.object({
  reservationReference: z.string(),
  invoiceReference: z.string(),
  paymentMethod: BookingPaymentMethodSchema,
  /** Real reservation.status after atomic create (awaiting_payment for card/bank_transfer). */
  reservationStatus: z.enum([
    "pending",
    "awaiting_payment",
    "confirmed",
    "cancelled",
    "completed",
    "no_show",
  ]),
  /** Present when paymentMethod is bank_transfer — RIB + libellé for the client. */
  bankTransfer: BankTransferInstructionsSchema.optional(),
});

export type BookingCheckEmailRequest = z.infer<typeof BookingCheckEmailRequestSchema>;
export type BookingCheckEmailResponse = z.infer<typeof BookingCheckEmailResponseSchema>;
export type BookingVerifyAccountRequest = z.infer<typeof BookingVerifyAccountRequestSchema>;
export type BookingVerifyAccountResponse = z.infer<typeof BookingVerifyAccountResponseSchema>;
export type BookingConfirmRequest = z.infer<typeof BookingConfirmRequestSchema>;
export type BookingConfirmResponse = z.infer<typeof BookingConfirmResponseSchema>;

export const BookingConfirmErrorResponseSchema = z.object({
  code: z.enum([
    BOOKING_CONFIRM_ERROR_CODES.LOCK_EXPIRED,
    BOOKING_CONFIRM_ERROR_CODES.LOCK_ALREADY_CONSUMED,
    BOOKING_CONFIRM_ERROR_CODES.LOCK_MISMATCH,
    BOOKING_CONFIRM_ERROR_CODES.SLOT_OVERLAP,
    BOOKING_CONFIRM_ERROR_CODES.INVALID_CREDENTIALS,
    BOOKING_CONFIRM_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
    BOOKING_CONFIRM_ERROR_CODES.VALIDATION_ERROR,
    BOOKING_CONFIRM_ERROR_CODES.BANK_TRANSFER_NOT_ELIGIBLE,
    BOOKING_CONFIRM_ERROR_CODES.BANK_TRANSFER_NOT_CONFIGURED,
  ]),
  message: z.string(),
});
