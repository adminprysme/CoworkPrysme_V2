import {
  DEFAULT_VITRINE_MARQUEE_TEXT,
  VITRINE_CONTENT_SINGLETON_ID,
  VitrineContentResponseSchema,
  type VitrineContentResponse,
  type VitrineImageSlot,
} from "@coworkprysme/shared";
import {
  connectMongo,
  getVitrineContentModel,
  type VitrineContentDocumentData,
} from "@coworkprysme/db";

export function mapVitrineContentToResponse(
  doc: VitrineContentDocumentData,
): VitrineContentResponse {
  return VitrineContentResponseSchema.parse({
    heroImages: doc.heroImages,
    conceptImage: doc.conceptImage,
    serviceImages: doc.serviceImages,
    featuredSpaceIds: doc.featuredSpaceIds ?? [],
    marquee: doc.marquee,
  });
}

export function createDefaultVitrineContentDocument(): Omit<
  VitrineContentDocumentData,
  "createdAt" | "updatedAt"
> {
  return {
    _id: VITRINE_CONTENT_SINGLETON_ID,
    heroImages: [],
    conceptImage: null,
    serviceImages: {
      roomService: null,
      afterwork: null,
      conciergerie: null,
    },
    featuredSpaceIds: [],
    marquee: {
      enabled: true,
      text: DEFAULT_VITRINE_MARQUEE_TEXT,
    },
  };
}

export function isSingleImageSlot(slot: VitrineImageSlot): boolean {
  return slot !== "hero";
}

export function getServiceImageField(
  slot: VitrineImageSlot,
): keyof VitrineContentDocumentData["serviceImages"] | null {
  switch (slot) {
    case "room-service":
      return "roomService";
    case "afterwork":
      return "afterwork";
    case "conciergerie":
      return "conciergerie";
    default:
      return null;
  }
}

export async function getOrCreateVitrineContentDocument() {
  await connectMongo();
  const VitrineContent = await getVitrineContentModel();
  const existing = await VitrineContent.findById(VITRINE_CONTENT_SINGLETON_ID).lean().exec();
  if (existing) {
    return existing as VitrineContentDocumentData;
  }

  const created = await VitrineContent.create(createDefaultVitrineContentDocument());
  return created.toObject() as VitrineContentDocumentData;
}
