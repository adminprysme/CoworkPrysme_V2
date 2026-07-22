import path from "node:path";

/** Allowlist driven by magic bytes (`file-type`), never by client filename extension. */
export const CARDEX_DOCUMENT_ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type CardexDocumentAcceptedMime = (typeof CARDEX_DOCUMENT_ACCEPTED_MIME_TYPES)[number];

const MIME_TO_EXTENSION: Record<CardexDocumentAcceptedMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ACCEPTED_EXTENSIONS = new Set(Object.values(MIME_TO_EXTENSION));

/** `cardex-documents/{objectId}/{uuid}.{pdf|jpg|png|webp}` */
export const CARDEX_DOCUMENT_STORAGE_KEY_PATTERN =
  /^cardex-documents\/[a-f0-9]{24}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/;

export const CARDEX_ID_PATTERN = /^[a-f0-9]{24}$/;

export const DOCUMENT_STORAGE_ERROR_CODES = {
  EMPTY_FILE: "EMPTY_FILE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  UNSUPPORTED_FILE_TYPE: "UNSUPPORTED_FILE_TYPE",
  INVALID_CARDEX_ID: "INVALID_CARDEX_ID",
  INVALID_STORAGE_KEY: "INVALID_STORAGE_KEY",
} as const;

export type DocumentStorageErrorCode =
  (typeof DOCUMENT_STORAGE_ERROR_CODES)[keyof typeof DOCUMENT_STORAGE_ERROR_CODES];

export function isCardexDocumentAcceptedMime(mime: string): mime is CardexDocumentAcceptedMime {
  return (CARDEX_DOCUMENT_ACCEPTED_MIME_TYPES as readonly string[]).includes(mime);
}

export function extensionForDocumentMime(mime: string): string | null {
  if (!isCardexDocumentAcceptedMime(mime)) {
    return null;
  }
  return MIME_TO_EXTENSION[mime];
}

export function isValidCardexId(cardexId: string): boolean {
  return CARDEX_ID_PATTERN.test(cardexId);
}

export function buildCardexDocumentStorageKey(
  cardexId: string,
  fileId: string,
  extension: string,
): string {
  return `cardex-documents/${cardexId}/${fileId}.${extension}`;
}

export function isValidCardexDocumentStorageKey(storageKey: string): boolean {
  if (!CARDEX_DOCUMENT_STORAGE_KEY_PATTERN.test(storageKey)) {
    return false;
  }
  const ext = storageKey.slice(storageKey.lastIndexOf(".") + 1);
  return ACCEPTED_EXTENSIONS.has(ext);
}

/**
 * Resolve a cardex-document storageKey under UPLOADS_DIR.
 * Returns null when the key is malformed or path-resolves outside uploadsDir
 * (same traversal guard as entity/vitrine photo keys).
 */
export function resolveCardexDocumentAbsolutePath(
  uploadsDir: string,
  storageKey: string,
): string | null {
  if (!isValidCardexDocumentStorageKey(storageKey)) {
    return null;
  }

  const absoluteUploads = path.resolve(uploadsDir);
  const absoluteTarget = path.resolve(absoluteUploads, storageKey);
  const uploadsPrefix = absoluteUploads.endsWith(path.sep)
    ? absoluteUploads
    : `${absoluteUploads}${path.sep}`;

  if (!absoluteTarget.startsWith(uploadsPrefix)) {
    return null;
  }

  return absoluteTarget;
}
