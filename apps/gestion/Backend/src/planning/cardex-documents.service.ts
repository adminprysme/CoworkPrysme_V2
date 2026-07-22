import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  connectMongo,
  getCardexModel,
  type CardexDocument,
  type CardexDocumentMeta,
  type StaffProfileDocument,
} from "@coworkprysme/db";
import {
  CARDEX_DOCUMENT_STAFF_ERROR_CODES,
  CARDEX_DOCUMENT_STAFF_ERROR_MESSAGES,
  StaffCardexDocumentSchema,
  StaffCardexDocumentsListResponseSchema,
  type StaffCardexDocument,
  type StaffCardexDocumentsListResponse,
  type StaffUploadCardexDocumentFields,
} from "@coworkprysme/shared";
import { access } from "node:fs/promises";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { DocumentStorageService } from "../document-storage/document-storage.service.js";
import { writeCardexDocumentAudit } from "./cardex-documents-audit.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function assertObjectId(value: string, label: string): string {
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw new BadRequestException({
      code: CARDEX_DOCUMENT_STAFF_ERROR_CODES.INVALID_ID,
      message: `${label} invalide`,
    });
  }
  return value;
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

type CardexDocumentEntry = CardexDocumentMeta & { _id: Types.ObjectId };

/** Mongoose DocumentArray helpers are erased on the Cardex interface typing. */
function documentsArray(cardex: CardexDocument): {
  id(id: string): CardexDocumentEntry | null;
  pull(id: Types.ObjectId): void;
  [Symbol.iterator](): Iterator<CardexDocumentEntry>;
  readonly length: number;
  [index: number]: CardexDocumentEntry;
} {
  return cardex.documents as unknown as {
    id(id: string): CardexDocumentEntry | null;
    pull(id: Types.ObjectId): void;
    [Symbol.iterator](): Iterator<CardexDocumentEntry>;
    readonly length: number;
    [index: number]: CardexDocumentEntry;
  };
}

function mapDocument(doc: CardexDocumentEntry): StaffCardexDocument {
  return StaffCardexDocumentSchema.parse({
    id: String(doc._id),
    category: doc.category,
    clientVisible: doc.clientVisible,
    ...(doc.label ? { label: doc.label } : {}),
    originalFilename: doc.originalFilename,
    contentType: doc.contentType,
    sizeBytes: doc.sizeBytes,
    uploadedAt: toIso(doc.uploadedAt),
    uploadedByStaffProfileId: String(doc.uploadedByStaffProfileId),
  });
}

@Injectable()
export class CardexDocumentsService {
  private readonly logger = new Logger(CardexDocumentsService.name);

  constructor(private readonly documentStorage: DocumentStorageService) {}

  async list(cardexId: string): Promise<StaffCardexDocumentsListResponse> {
    await connectMongo();
    const id = assertObjectId(cardexId, "cardexId");
    const Cardex = await getCardexModel();
    const cardex = await Cardex.findById(id).exec();
    if (!cardex) {
      throw new NotFoundException({
        code: CARDEX_DOCUMENT_STAFF_ERROR_CODES.CARDEX_NOT_FOUND,
        message: CARDEX_DOCUMENT_STAFF_ERROR_MESSAGES.CARDEX_NOT_FOUND,
      });
    }

    const contracts: StaffCardexDocument[] = [];
    const others: StaffCardexDocument[] = [];
    for (const entry of documentsArray(cardex)) {
      const mapped = mapDocument(entry);
      if (mapped.category === "contract") {
        contracts.push(mapped);
      } else {
        others.push(mapped);
      }
    }

    return StaffCardexDocumentsListResponseSchema.parse({ contracts, others });
  }

  async upload(
    profile: StaffProfileDocument,
    cardexId: string,
    buffer: Buffer,
    originalFilename: string,
    fields: StaffUploadCardexDocumentFields,
  ): Promise<StaffCardexDocument> {
    await connectMongo();
    const id = assertObjectId(cardexId, "cardexId");
    const Cardex = await getCardexModel();
    const cardex = await Cardex.findById(id).exec();
    if (!cardex) {
      throw new NotFoundException({
        code: CARDEX_DOCUMENT_STAFF_ERROR_CODES.CARDEX_NOT_FOUND,
        message: CARDEX_DOCUMENT_STAFF_ERROR_MESSAGES.CARDEX_NOT_FOUND,
      });
    }

    const safeFilename =
      originalFilename.trim().slice(0, 255) ||
      `document.${fields.category === "contract" ? "pdf" : "bin"}`;

    const stored = await this.documentStorage.store(id, buffer);
    const uploadedAt = new Date();
    const clientVisible = fields.category === "contract";

    try {
      cardex.documents.push({
        category: fields.category,
        clientVisible,
        ...(fields.label ? { label: fields.label } : {}),
        originalFilename: safeFilename,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
        uploadedAt,
        uploadedByStaffProfileId: profile._id,
      });
      await cardex.save();
    } catch (error) {
      await this.documentStorage.delete(stored.storageKey);
      throw error;
    }

    const created = cardex.documents[cardex.documents.length - 1] as unknown as CardexDocumentEntry;
    return mapDocument(created);
  }

  /**
   * Strict membership: documentId must belong to the given cardexId's documents[].
   * Wrong cardex → same 404 as missing document (no existence leak).
   */
  async prepareDownload(
    cardexId: string,
    documentId: string,
  ): Promise<{ absolutePath: string; contentType: string; originalFilename: string }> {
    const { entry } = await this.findDocumentInCardex(cardexId, documentId);
    const absolutePath = this.documentStorage.resolveAbsolutePath(entry.storageKey);
    try {
      await access(absolutePath);
    } catch {
      throw new NotFoundException({
        code: CARDEX_DOCUMENT_STAFF_ERROR_CODES.DOCUMENT_NOT_FOUND,
        message: CARDEX_DOCUMENT_STAFF_ERROR_MESSAGES.DOCUMENT_NOT_FOUND,
      });
    }
    return {
      absolutePath,
      contentType: entry.contentType,
      originalFilename: entry.originalFilename,
    };
  }

  async delete(
    profile: StaffProfileDocument,
    cardexId: string,
    documentId: string,
  ): Promise<{ ok: true }> {
    const { cardex, entry, id, docId } = await this.findDocumentInCardex(cardexId, documentId);

    const category = entry.category;
    const label = entry.label;
    const originalFilename = entry.originalFilename;
    const uploadedByStaffProfileId = entry.uploadedByStaffProfileId;
    const storageKey = entry.storageKey;

    try {
      const absolutePath = this.documentStorage.resolveAbsolutePath(storageKey);
      await access(absolutePath);
    } catch (error) {
      this.logger.warn(
        `document.deleted: disk file missing or unreadable for cardex=${id} document=${docId} key=${storageKey} (${(error as Error).message}) — removing DB entry anyway`,
      );
    }

    await this.documentStorage.delete(storageKey);

    documentsArray(cardex).pull(entry._id);
    await cardex.save();

    await writeCardexDocumentAudit({
      profile,
      action: "document.deleted",
      cardexId: id,
      documentId: docId,
      category,
      label,
      originalFilename,
      uploadedByStaffProfileId,
    });

    return { ok: true };
  }

  async updateLabel(
    cardexId: string,
    documentId: string,
    label: string,
  ): Promise<StaffCardexDocument> {
    const { cardex, entry, id, docId } = await this.findDocumentInCardex(cardexId, documentId);
    const trimmed = label.trim();
    const Cardex = await getCardexModel();

    if (trimmed.length > 0) {
      await Cardex.updateOne(
        { _id: id, "documents._id": docId },
        { $set: { "documents.$.label": trimmed } },
      ).exec();
      entry.label = trimmed;
    } else {
      await Cardex.updateOne(
        { _id: id, "documents._id": docId },
        { $unset: { "documents.$.label": "" } },
      ).exec();
      Reflect.deleteProperty(entry, "label");
    }

    // Re-read mapped view from DB to mirror list payload
    const refreshed = await Cardex.findById(cardex._id).exec();
    const next = refreshed ? documentsArray(refreshed).id(docId) : null;
    if (!next) {
      throw new NotFoundException({
        code: CARDEX_DOCUMENT_STAFF_ERROR_CODES.DOCUMENT_NOT_FOUND,
        message: CARDEX_DOCUMENT_STAFF_ERROR_MESSAGES.DOCUMENT_NOT_FOUND,
      });
    }
    return mapDocument(next);
  }

  private async findDocumentInCardex(
    cardexId: string,
    documentId: string,
  ): Promise<{
    cardex: CardexDocument;
    entry: CardexDocumentEntry;
    id: string;
    docId: string;
  }> {
    await connectMongo();
    const id = assertObjectId(cardexId, "cardexId");
    const docId = assertObjectId(documentId, "documentId");
    const Cardex = await getCardexModel();
    const cardex = await Cardex.findById(id).exec();
    if (!cardex) {
      throw new NotFoundException({
        code: CARDEX_DOCUMENT_STAFF_ERROR_CODES.DOCUMENT_NOT_FOUND,
        message: CARDEX_DOCUMENT_STAFF_ERROR_MESSAGES.DOCUMENT_NOT_FOUND,
      });
    }

    const entry = documentsArray(cardex).id(docId);
    if (!entry) {
      throw new NotFoundException({
        code: CARDEX_DOCUMENT_STAFF_ERROR_CODES.DOCUMENT_NOT_FOUND,
        message: CARDEX_DOCUMENT_STAFF_ERROR_MESSAGES.DOCUMENT_NOT_FOUND,
      });
    }

    return { cardex, entry, id, docId };
  }
}
