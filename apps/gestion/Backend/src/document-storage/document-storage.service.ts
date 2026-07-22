import { BadRequestException, Injectable } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { parseGestionApiEnv, resolveUploadsDir } from "@coworkprysme/shared/server";
import { fileTypeFromBuffer } from "file-type";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCardexDocumentStorageKey,
  DOCUMENT_STORAGE_ERROR_CODES,
  extensionForDocumentMime,
  isCardexDocumentAcceptedMime,
  isValidCardexDocumentStorageKey,
  isValidCardexId,
  resolveCardexDocumentAbsolutePath,
} from "./document-storage.helpers.js";

export interface StoredCardexDocument {
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  extension: string;
}

@Injectable()
export class DocumentStorageService implements OnModuleInit {
  private uploadsDir = "";

  async onModuleInit(): Promise<void> {
    const env = parseGestionApiEnv();
    this.uploadsDir = resolveUploadsDir(process.env, process.cwd());
    if (env.UPLOADS_DIR?.trim()) {
      this.uploadsDir = path.resolve(env.UPLOADS_DIR.trim());
    }
    await mkdir(this.uploadsDir, { recursive: true });
  }

  getUploadsDir(): string {
    return this.uploadsDir;
  }

  getMaxBytes(): number {
    return parseGestionApiEnv().UPLOAD_MAX_BYTES_DOCUMENT;
  }

  /**
   * Validate magic bytes + size, write raw bytes (no sharp/WebP), return storage metadata.
   * Extension and contentType come from detected MIME — never from the client filename.
   */
  async store(
    cardexId: string,
    buffer: Buffer,
    options?: { fileId?: string },
  ): Promise<StoredCardexDocument> {
    if (!isValidCardexId(cardexId)) {
      throw new BadRequestException({
        code: DOCUMENT_STORAGE_ERROR_CODES.INVALID_CARDEX_ID,
        message: "Identifiant cardex invalide",
      });
    }

    if (buffer.length === 0) {
      throw new BadRequestException({
        code: DOCUMENT_STORAGE_ERROR_CODES.EMPTY_FILE,
        message: "Fichier vide",
      });
    }

    const maxBytes = this.getMaxBytes();
    if (buffer.length > maxBytes) {
      throw new BadRequestException({
        code: DOCUMENT_STORAGE_ERROR_CODES.FILE_TOO_LARGE,
        message: `Fichier trop volumineux (maximum ${maxBytes} octets)`,
      });
    }

    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !isCardexDocumentAcceptedMime(detected.mime)) {
      throw new BadRequestException({
        code: DOCUMENT_STORAGE_ERROR_CODES.UNSUPPORTED_FILE_TYPE,
        message:
          "Type de fichier non supporté (PDF, JPEG, PNG ou WebP uniquement — contrôle sur le contenu réel)",
      });
    }

    const extension = extensionForDocumentMime(detected.mime);
    if (!extension) {
      throw new BadRequestException({
        code: DOCUMENT_STORAGE_ERROR_CODES.UNSUPPORTED_FILE_TYPE,
        message:
          "Type de fichier non supporté (PDF, JPEG, PNG ou WebP uniquement — contrôle sur le contenu réel)",
      });
    }

    const fileId = options?.fileId ?? crypto.randomUUID();
    const storageKey = buildCardexDocumentStorageKey(cardexId, fileId, extension);
    if (!isValidCardexDocumentStorageKey(storageKey)) {
      throw new BadRequestException({
        code: DOCUMENT_STORAGE_ERROR_CODES.INVALID_STORAGE_KEY,
        message: "Clé de stockage invalide",
      });
    }

    const absolutePath = resolveCardexDocumentAbsolutePath(this.uploadsDir, storageKey);
    if (!absolutePath) {
      throw new BadRequestException({
        code: DOCUMENT_STORAGE_ERROR_CODES.INVALID_STORAGE_KEY,
        message: "Clé de stockage invalide",
      });
    }

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      storageKey,
      contentType: detected.mime,
      sizeBytes: buffer.length,
      extension,
    };
  }

  /** Absolute path under UPLOADS_DIR, or BadRequest if key is invalid / escapes the uploads root. */
  resolveAbsolutePath(storageKey: string): string {
    const absolutePath = resolveCardexDocumentAbsolutePath(this.uploadsDir, storageKey);
    if (!absolutePath) {
      throw new BadRequestException({
        code: DOCUMENT_STORAGE_ERROR_CODES.INVALID_STORAGE_KEY,
        message: "Clé de stockage invalide ou hors du répertoire d'uploads",
      });
    }
    return absolutePath;
  }

  async delete(storageKey: string): Promise<void> {
    if (!isValidCardexDocumentStorageKey(storageKey)) {
      return;
    }

    const absolutePath = resolveCardexDocumentAbsolutePath(this.uploadsDir, storageKey);
    if (!absolutePath) {
      return;
    }

    try {
      await rm(absolutePath, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
