import { describe, expect, it } from "vitest";

import {
  StaffCardexDocumentsListResponseSchema,
  StaffPatchCardexDocumentRequestSchema,
  StaffUploadCardexDocumentFieldsSchema,
} from "./cardex-documents-staff.js";

describe("cardex-documents-staff schemas", () => {
  it("derives optional empty label to undefined", () => {
    const parsed = StaffUploadCardexDocumentFieldsSchema.parse({
      category: "other",
      label: "   ",
    });
    expect(parsed).toEqual({ category: "other", label: undefined });
  });

  it("accepts a grouped list payload without storageKey", () => {
    const parsed = StaffCardexDocumentsListResponseSchema.parse({
      contracts: [
        {
          id: "507f1f77bcf86cd799439011",
          category: "contract",
          clientVisible: true,
          originalFilename: "contrat.pdf",
          contentType: "application/pdf",
          sizeBytes: 12,
          uploadedAt: "2026-07-22T08:00:00.000Z",
          uploadedByStaffProfileId: "507f1f77bcf86cd799439012",
        },
      ],
      others: [],
    });
    expect(parsed.contracts[0]?.clientVisible).toBe(true);
    expect(parsed.contracts[0]).not.toHaveProperty("storageKey");
  });

  it("patch label trims and allows empty clear", () => {
    expect(StaffPatchCardexDocumentRequestSchema.parse({ label: "  RIB  " })).toEqual({
      label: "RIB",
    });
    expect(StaffPatchCardexDocumentRequestSchema.parse({ label: "   " })).toEqual({ label: "" });
  });

  it("rejects patch labels longer than 120 chars", () => {
    expect(() => StaffPatchCardexDocumentRequestSchema.parse({ label: "x".repeat(121) })).toThrow();
  });
});
