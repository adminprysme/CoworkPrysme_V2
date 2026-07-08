import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  UpdateVitrineContentRequestSchema,
  VITRINE_HERO_MAX_IMAGES,
  VITRINE_IMAGE_SLOTS,
  isValidVitrineImageStorageKey,
  type VitrineContentResponse,
  type VitrineImageSlot,
} from "@coworkprysme/shared";
import { connectMongo, getVitrineContentModel } from "@coworkprysme/db";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { UploadsService } from "../uploads/uploads.service.js";
import {
  getOrCreateVitrineContentDocument,
  getServiceImageField,
  mapVitrineContentToResponse,
} from "./vitrine-content.mapper.js";

function parseSlot(slot: string): VitrineImageSlot {
  if (!VITRINE_IMAGE_SLOTS.includes(slot as VitrineImageSlot)) {
    throw new NotFoundException();
  }
  return slot as VitrineImageSlot;
}

@Injectable()
export class VitrineContentService {
  constructor(private readonly uploads: UploadsService) {}

  async getContent(): Promise<VitrineContentResponse> {
    const doc = await getOrCreateVitrineContentDocument();
    return mapVitrineContentToResponse(doc);
  }

  async updateContent(body: unknown): Promise<VitrineContentResponse> {
    const parsed = UpdateVitrineContentRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const payload = parsed.data;
    const doc = await getOrCreateVitrineContentDocument();

    if (payload.heroImages) {
      for (const storageKey of payload.heroImages) {
        if (!isValidVitrineImageStorageKey(storageKey)) {
          throw new BadRequestException("Invalid hero image storage key");
        }
      }
      doc.heroImages = payload.heroImages;
    }

    if (payload.marquee) {
      doc.marquee = {
        ...doc.marquee,
        ...payload.marquee,
      };
    }

    await connectMongo();
    const VitrineContent = await getVitrineContentModel();
    const updated = await VitrineContent.findByIdAndUpdate(
      doc._id,
      {
        heroImages: doc.heroImages,
        marquee: doc.marquee,
      },
      { new: true, runValidators: true },
    )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException();
    }

    return mapVitrineContentToResponse(updated);
  }

  async uploadImage(slotParam: string, buffer: Buffer): Promise<VitrineContentResponse> {
    const slot = parseSlot(slotParam);
    const doc = await getOrCreateVitrineContentDocument();
    const fileId = crypto.randomUUID();
    const { storageKey } = await this.uploads.storeVitrineImage(slot, buffer, fileId);

    let replacedStorageKey: string | null = null;

    if (slot === "hero") {
      if (doc.heroImages.length >= VITRINE_HERO_MAX_IMAGES) {
        await this.uploads.deleteVitrineImageFile(storageKey);
        throw new BadRequestException(`Maximum ${VITRINE_HERO_MAX_IMAGES} hero images`);
      }
      doc.heroImages = [...doc.heroImages, storageKey];
    } else if (slot === "concept") {
      replacedStorageKey = doc.conceptImage;
      doc.conceptImage = storageKey;
    } else {
      const field = getServiceImageField(slot);
      if (!field) {
        await this.uploads.deleteVitrineImageFile(storageKey);
        throw new BadRequestException("Invalid slot");
      }
      replacedStorageKey = doc.serviceImages[field];
      doc.serviceImages = {
        ...doc.serviceImages,
        [field]: storageKey,
      };
    }

    try {
      await connectMongo();
      const VitrineContent = await getVitrineContentModel();
      const updated = await VitrineContent.findByIdAndUpdate(doc._id, doc, {
        new: true,
        runValidators: true,
      })
        .lean()
        .exec();

      if (!updated) {
        throw new NotFoundException();
      }

      if (replacedStorageKey) {
        await this.uploads.deleteVitrineImageFile(replacedStorageKey);
      }

      return mapVitrineContentToResponse(updated);
    } catch (error) {
      await this.uploads.deleteVitrineImageFile(storageKey);
      throw error;
    }
  }

  async deleteImage(slotParam: string, filename: string): Promise<VitrineContentResponse> {
    const slot = parseSlot(slotParam);
    const normalizedFilename = filename.endsWith(".webp") ? filename : `${filename}.webp`;
    const storageKey = `vitrine/${slot}/${normalizedFilename}`;
    if (!isValidVitrineImageStorageKey(storageKey)) {
      throw new BadRequestException("Invalid storage key");
    }

    const doc = await getOrCreateVitrineContentDocument();

    if (slot === "hero") {
      if (!doc.heroImages.includes(storageKey)) {
        throw new NotFoundException();
      }
      doc.heroImages = doc.heroImages.filter((key) => key !== storageKey);
    } else if (slot === "concept") {
      if (doc.conceptImage !== storageKey) {
        throw new NotFoundException();
      }
      doc.conceptImage = null;
    } else {
      const field = getServiceImageField(slot);
      if (!field || doc.serviceImages[field] !== storageKey) {
        throw new NotFoundException();
      }
      doc.serviceImages = {
        ...doc.serviceImages,
        [field]: null,
      };
    }

    await this.uploads.deleteVitrineImageFile(storageKey);

    await connectMongo();
    const VitrineContent = await getVitrineContentModel();
    const updated = await VitrineContent.findByIdAndUpdate(doc._id, doc, {
      new: true,
      runValidators: true,
    })
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException();
    }

    return mapVitrineContentToResponse(updated);
  }

  async ensureSeedDocument(): Promise<void> {
    await getOrCreateVitrineContentDocument();
  }
}
