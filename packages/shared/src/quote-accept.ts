import { z } from "zod";

/**
 * Public vitrine quote-accept + password-activation DTOs (§5.1).
 * Full AcceptQuoteService confirm payload lands in #8.
 */

export const QUOTE_ACCEPT_ERROR_CODES = {
  QUOTE_ACCEPT_NOT_FOUND: "QUOTE_ACCEPT_NOT_FOUND",
  QUOTE_ACCEPT_EXPIRED: "QUOTE_ACCEPT_EXPIRED",
  QUOTE_ACCEPT_INVALID_STATUS: "QUOTE_ACCEPT_INVALID_STATUS",
  QUOTE_ACCEPT_EMAIL_REGISTERED: "QUOTE_ACCEPT_EMAIL_REGISTERED",
  QUOTE_ACCEPT_SLOT_UNAVAILABLE: "QUOTE_ACCEPT_SLOT_UNAVAILABLE",
  QUOTE_ACCEPT_ACCOUNT_REQUIRED: "QUOTE_ACCEPT_ACCOUNT_REQUIRED",
  QUOTE_ACCEPT_ACCOUNT_INVALID: "QUOTE_ACCEPT_ACCOUNT_INVALID",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type QuoteAcceptErrorCode =
  (typeof QUOTE_ACCEPT_ERROR_CODES)[keyof typeof QUOTE_ACCEPT_ERROR_CODES];

export const CLIENT_ACCOUNT_ACTIVATION_ERROR_CODES = {
  ACTIVATION_NOT_FOUND: "ACTIVATION_NOT_FOUND",
  ACTIVATION_EXPIRED: "ACTIVATION_EXPIRED",
  ACTIVATION_REVOKED: "ACTIVATION_REVOKED",
  ACTIVATION_ALREADY_USED: "ACTIVATION_ALREADY_USED",
  ACTIVATION_ACCOUNT_INVALID: "ACTIVATION_ACCOUNT_INVALID",
  ACTIVATION_EMAIL_MISMATCH: "ACTIVATION_EMAIL_MISMATCH",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type ClientAccountActivationErrorCode =
  (typeof CLIENT_ACCOUNT_ACTIVATION_ERROR_CODES)[keyof typeof CLIENT_ACCOUNT_ACTIVATION_ERROR_CODES];

/** GET /quotes/accept/:token — preview (never tokenHash / internalNote). */
export const PublicQuoteAcceptPreviewSchema = z.object({
  quoteId: z.string().min(1),
  reference: z.string().min(1),
  status: z.literal("sent"),
  validUntil: z.string().datetime(),
  emailMasked: z.string().min(1),
  needsRegistration: z.boolean(),
  paymentMethodPreferred: z.enum(["card", "bank_transfer", "direct_debit"]).optional(),
  totals: z
    .object({
      totalHT: z.number().int(),
      totalTTC: z.number().int(),
      totalVAT: z.number().int(),
    })
    .optional(),
});
export type PublicQuoteAcceptPreview = z.infer<typeof PublicQuoteAcceptPreviewSchema>;

/**
 * POST /quotes/accept/:token/register — create active account before confirm (#8).
 * Identity + CGV aligned with booking new-account rules.
 */
export const PublicQuoteAcceptRegisterRequestSchema = z
  .object({
    password: z.string().min(8, "Mot de passe invalide"),
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    phone: z.string().trim().min(1).optional(),
    privacyPolicyAccepted: z.boolean().optional(),
    marketingCommunicationsAccepted: z.boolean().optional(),
    cgvAccepted: z.literal(true, { message: "L'acceptation des CGV est obligatoire" }),
  })
  .superRefine((value, context) => {
    if (!value.privacyPolicyAccepted) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["privacyPolicyAccepted"],
        message: "Le consentement à la politique de confidentialité est obligatoire",
      });
    }
  });
export type PublicQuoteAcceptRegisterRequest = z.infer<
  typeof PublicQuoteAcceptRegisterRequestSchema
>;

export const PublicQuoteAcceptRegisterResponseSchema = z.object({
  clientAccount: z.object({
    id: z.string(),
    email: z.string().email(),
    status: z.literal("active"),
  }),
});
export type PublicQuoteAcceptRegisterResponse = z.infer<
  typeof PublicQuoteAcceptRegisterResponseSchema
>;

/**
 * POST /quotes/accept/:token/confirm — final accept via unified AcceptQuoteService.
 * Provide either `clientAccountId` (existing) or register credentials (create-then-accept).
 */
export const PublicQuoteAcceptConfirmRequestSchema = z
  .object({
    clientAccountId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
    password: z.string().min(8).optional(),
    privacyPolicyAccepted: z.boolean().optional(),
    marketingCommunicationsAccepted: z.boolean().optional(),
    cgvAccepted: z.literal(true).optional(),
  })
  .superRefine((value, context) => {
    const hasAccount = Boolean(value.clientAccountId);
    const hasRegister = Boolean(value.password);
    if (hasAccount === hasRegister) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Indiquez soit clientAccountId (compte existant), soit password (création à la volée).",
      });
    }
    if (hasRegister) {
      if (!value.privacyPolicyAccepted) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["privacyPolicyAccepted"],
          message: "Le consentement à la politique de confidentialité est obligatoire",
        });
      }
      if (value.cgvAccepted !== true) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cgvAccepted"],
          message: "L'acceptation des CGV est obligatoire",
        });
      }
    }
  });
export type PublicQuoteAcceptConfirmRequest = z.infer<typeof PublicQuoteAcceptConfirmRequestSchema>;

export const PublicQuoteAcceptConfirmResponseSchema = z.object({
  quoteId: z.string().min(1),
  reference: z.string().min(1),
  reservationIds: z.array(z.string().min(1)).min(1),
  invoiceId: z.string().min(1),
  invoiceReference: z.string().min(1),
  cardexId: z.string().min(1),
  clientAccountId: z.string().min(1),
  status: z.literal("accepted"),
  /** Present when card payment-link was issued at accept. */
  paymentUrl: z.string().url().optional(),
});
export type PublicQuoteAcceptConfirmResponse = z.infer<
  typeof PublicQuoteAcceptConfirmResponseSchema
>;

/** POST /quotes/accept/:token/confirm-login — existing account email+password then accept. */
export const PublicQuoteAcceptConfirmLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Mot de passe requis"),
});
export type PublicQuoteAcceptConfirmLoginRequest = z.infer<
  typeof PublicQuoteAcceptConfirmLoginRequestSchema
>;

/** GET activation token preview (staff-accept set-password). */
export const PublicAccountActivationPreviewSchema = z.object({
  emailMasked: z.string().min(1),
  expiresAt: z.string().datetime(),
});
export type PublicAccountActivationPreview = z.infer<typeof PublicAccountActivationPreviewSchema>;

export const PublicAccountActivationAcceptRequestSchema = z.object({
  password: z.string().min(8, "Mot de passe invalide"),
});
export type PublicAccountActivationAcceptRequest = z.infer<
  typeof PublicAccountActivationAcceptRequestSchema
>;

export const PublicAccountActivationAcceptResponseSchema = z.object({
  clientAccount: z.object({
    id: z.string(),
    email: z.string().email(),
    status: z.literal("active"),
  }),
});
export type PublicAccountActivationAcceptResponse = z.infer<
  typeof PublicAccountActivationAcceptResponseSchema
>;
