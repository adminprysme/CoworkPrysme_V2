import { z } from "zod";

/** Mirrors packages/db CARDEX_DOCUMENT_CATEGORIES (keep in sync). */
export const StaffCardexDocumentCategorySchema = z.enum(["contract", "other"]);
export type StaffCardexDocumentCategory = z.infer<typeof StaffCardexDocumentCategorySchema>;

/** Mirrors packages/db CARDEX_DOCUMENT_LABEL_MAX_LENGTH. */
export const STAFF_CARDEX_DOCUMENT_LABEL_MAX_LENGTH = 120;

export const StaffUploadCardexDocumentFieldsSchema = z.object({
  category: StaffCardexDocumentCategorySchema,
  label: z
    .string()
    .trim()
    .max(STAFF_CARDEX_DOCUMENT_LABEL_MAX_LENGTH)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});
export type StaffUploadCardexDocumentFields = z.infer<typeof StaffUploadCardexDocumentFieldsSchema>;

/** PATCH label only — empty string clears the label. */
export const StaffPatchCardexDocumentRequestSchema = z.object({
  label: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(STAFF_CARDEX_DOCUMENT_LABEL_MAX_LENGTH)),
});
export type StaffPatchCardexDocumentRequest = z.infer<typeof StaffPatchCardexDocumentRequestSchema>;

export const StaffCardexDocumentSchema = z.object({
  id: z.string(),
  category: StaffCardexDocumentCategorySchema,
  clientVisible: z.boolean(),
  label: z.string().optional(),
  originalFilename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedAt: z.string().datetime(),
  uploadedByStaffProfileId: z.string(),
});
export type StaffCardexDocument = z.infer<typeof StaffCardexDocumentSchema>;

export const StaffCardexDocumentsListResponseSchema = z.object({
  contracts: z.array(StaffCardexDocumentSchema),
  others: z.array(StaffCardexDocumentSchema),
});
export type StaffCardexDocumentsListResponse = z.infer<
  typeof StaffCardexDocumentsListResponseSchema
>;

export const CARDEX_DOCUMENT_STAFF_ERROR_CODES = {
  CARDEX_NOT_FOUND: "CARDEX_NOT_FOUND",
  DOCUMENT_NOT_FOUND: "DOCUMENT_NOT_FOUND",
  MISSING_FILE: "MISSING_FILE",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_ID: "INVALID_ID",
} as const;

export type CardexDocumentStaffErrorCode =
  (typeof CARDEX_DOCUMENT_STAFF_ERROR_CODES)[keyof typeof CARDEX_DOCUMENT_STAFF_ERROR_CODES];

export const CARDEX_DOCUMENT_STAFF_ERROR_MESSAGES = {
  CARDEX_NOT_FOUND: "Cardex introuvable.",
  DOCUMENT_NOT_FOUND: "Document introuvable.",
  MISSING_FILE: "Fichier manquant.",
  INVALID_ID: "Identifiant invalide.",
} as const;
