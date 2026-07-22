import { BadRequestException } from "@nestjs/common";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CARDEX_ID = "6a5f3efeebd0da8b88b67bc4";
const FILE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const mockEnv = {
  UPLOAD_MAX_BYTES_DOCUMENT: 15 * 1024 * 1024,
};

vi.mock("@coworkprysme/shared/server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    parseGestionApiEnv: () => mockEnv,
    resolveUploadsDir: (_env: unknown, cwd: string) => path.join(cwd, "uploads-test"),
  };
});

import {
  buildCardexDocumentStorageKey,
  DOCUMENT_STORAGE_ERROR_CODES,
  isValidCardexDocumentStorageKey,
  resolveCardexDocumentAbsolutePath,
} from "./document-storage.helpers.js";
import { DocumentStorageService } from "./document-storage.service.js";

/** Minimal valid PDF (file-type detects application/pdf). */
function minimalPdfBuffer(): Buffer {
  return Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
}

/** ZIP local-file header — not in the document allowlist. */
function zipBuffer(): Buffer {
  return Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
}

/** PE/DOS MZ header — not in the document allowlist. */
function exeBuffer(): Buffer {
  return Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
}

describe("document-storage.helpers", () => {
  it("builds and validates cardex-documents/{cardexId}/{uuid}.{ext}", () => {
    const key = buildCardexDocumentStorageKey(CARDEX_ID, FILE_ID, "pdf");
    expect(key).toBe(`cardex-documents/${CARDEX_ID}/${FILE_ID}.pdf`);
    expect(isValidCardexDocumentStorageKey(key)).toBe(true);
  });

  it("rejects path-traversal and malformed storage keys", () => {
    const uploadsDir = "/data/uploads";
    expect(resolveCardexDocumentAbsolutePath(uploadsDir, "../../../etc/passwd")).toBeNull();
    expect(
      resolveCardexDocumentAbsolutePath(
        uploadsDir,
        `cardex-documents/${CARDEX_ID}/../../etc/passwd.pdf`,
      ),
    ).toBeNull();
    expect(isValidCardexDocumentStorageKey("buildings/x/y.webp")).toBe(false);
    expect(isValidCardexDocumentStorageKey(`cardex-documents/${CARDEX_ID}/not-a-uuid.pdf`)).toBe(
      false,
    );
  });
});

describe("DocumentStorageService", () => {
  let service: DocumentStorageService;
  let tempDir: string;

  beforeEach(async () => {
    mockEnv.UPLOAD_MAX_BYTES_DOCUMENT = 15 * 1024 * 1024;
    tempDir = await mkdtemp(path.join(os.tmpdir(), "document-storage-"));
    service = new DocumentStorageService();
    (service as unknown as { uploadsDir: string }).uploadsDir = tempDir;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("stores a valid PDF as-is under cardex-documents/{cardexId}/{uuid}.pdf", async () => {
    const pdf = minimalPdfBuffer();

    const stored = await service.store(CARDEX_ID, pdf, { fileId: FILE_ID });

    expect(stored).toEqual({
      storageKey: `cardex-documents/${CARDEX_ID}/${FILE_ID}.pdf`,
      contentType: "application/pdf",
      sizeBytes: pdf.length,
      extension: "pdf",
    });

    const absolutePath = path.join(tempDir, stored.storageKey);
    const fileStat = await stat(absolutePath);
    expect(fileStat.isFile()).toBe(true);
    expect(await readFile(absolutePath)).toEqual(pdf);
  });

  it("rejects a .txt renamed as .pdf (magic bytes, not client extension)", async () => {
    const fakePdf = Buffer.from("this is plain text pretending to be a PDF");

    await expect(service.store(CARDEX_ID, fakePdf)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.store(CARDEX_ID, fakePdf)).rejects.toMatchObject({
      response: {
        code: DOCUMENT_STORAGE_ERROR_CODES.UNSUPPORTED_FILE_TYPE,
      },
    });
  });

  it("rejects files larger than UPLOAD_MAX_BYTES_DOCUMENT (15 Mo)", async () => {
    const oversized = Buffer.concat([minimalPdfBuffer(), Buffer.alloc(15 * 1024 * 1024)]);

    await expect(service.store(CARDEX_ID, oversized)).rejects.toMatchObject({
      response: {
        code: DOCUMENT_STORAGE_ERROR_CODES.FILE_TOO_LARGE,
      },
    });
  });

  it("rejects types outside the allowlist (zip, exe)", async () => {
    await expect(service.store(CARDEX_ID, zipBuffer())).rejects.toMatchObject({
      response: {
        code: DOCUMENT_STORAGE_ERROR_CODES.UNSUPPORTED_FILE_TYPE,
      },
    });
    await expect(service.store(CARDEX_ID, exeBuffer())).rejects.toMatchObject({
      response: {
        code: DOCUMENT_STORAGE_ERROR_CODES.UNSUPPORTED_FILE_TYPE,
      },
    });
  });

  it("rejects a manipulated storageKey that would escape UPLOADS_DIR", () => {
    expect(() => service.resolveAbsolutePath("../../../etc/passwd")).toThrow(BadRequestException);
    expect(() => service.resolveAbsolutePath("../../../etc/passwd")).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          code: DOCUMENT_STORAGE_ERROR_CODES.INVALID_STORAGE_KEY,
        }),
      }),
    );
  });

  it("stores JPEG/PNG/WebP without sharp conversion (raw bytes on disk)", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();

    const stored = await service.store(CARDEX_ID, png, { fileId: FILE_ID });
    expect(stored.contentType).toBe("image/png");
    expect(stored.extension).toBe("png");
    expect(stored.storageKey.endsWith(".png")).toBe(true);
    expect(await readFile(path.join(tempDir, stored.storageKey))).toEqual(png);
  });

  it("deletes a stored file from disk", async () => {
    const stored = await service.store(CARDEX_ID, minimalPdfBuffer(), { fileId: FILE_ID });
    const absolutePath = path.join(tempDir, stored.storageKey);
    await expect(stat(absolutePath)).resolves.toSatisfy((s) => s.isFile());

    await service.delete(stored.storageKey);
    await expect(stat(absolutePath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
