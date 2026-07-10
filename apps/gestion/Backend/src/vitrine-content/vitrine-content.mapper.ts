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

export function normalizeVitrineSiteContact(
  siteContact: { email?: string | null; phone?: string | null } | null | undefined,
) {
  return {
    email: siteContact?.email ?? null,
    phone: siteContact?.phone ?? null,
  };
}

export function mapVitrineContentToResponse(
  doc: VitrineContentDocumentData,
): VitrineContentResponse {
  return VitrineContentResponseSchema.parse({
    heroImages: doc.heroImages,
    conceptImage: doc.conceptImage,
    placeImage: doc.placeImage ?? null,
    serviceImages: doc.serviceImages,
    featuredSpaceIds: doc.featuredSpaceIds ?? [],
    featuredBuildingIds: doc.featuredBuildingIds ?? [],
    siteContact: normalizeVitrineSiteContact(doc.siteContact),
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
    placeImage: null,
    serviceImages: {
      roomService: null,
      afterwork: null,
      conciergerie: null,
    },
    featuredSpaceIds: [],
    featuredBuildingIds: [],
    siteContact: {
      email: null,
      phone: null,
    },
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
    const patch: Record<string, unknown> = {};
    if (!existing.siteContact) {
      patch.siteContact = normalizeVitrineSiteContact(undefined);
    }
    if (!existing.featuredBuildingIds) {
      patch.featuredBuildingIds = [];
    }
    if (existing.placeImage === undefined) {
      patch.placeImage = null;
    }
    if (Object.keys(patch).length > 0) {
      await VitrineContent.findByIdAndUpdate(VITRINE_CONTENT_SINGLETON_ID, patch).exec();
      return { ...existing, ...patch } as VitrineContentDocumentData;
    }
    return existing as VitrineContentDocumentData;
  }

  const created = await VitrineContent.create(createDefaultVitrineContentDocument());
  return created.toObject() as VitrineContentDocumentData;
}
