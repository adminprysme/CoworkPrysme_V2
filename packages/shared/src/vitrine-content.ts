import { z } from "zod";

export const VITRINE_CONTENT_SINGLETON_ID = "singleton";

export const VITRINE_IMAGE_SLOTS = [
  "hero",
  "concept",
  "room-service",
  "afterwork",
  "conciergerie",
] as const;

export type VitrineImageSlot = (typeof VITRINE_IMAGE_SLOTS)[number];

export const VITRINE_IMAGE_STORAGE_KEY_PATTERN =
  /^vitrine\/(hero|concept|room-service|afterwork|conciergerie)\/[0-9a-f-]{36}\.webp$/;

export const VITRINE_HERO_MAX_IMAGES = 8;
export const VITRINE_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

export const VitrineMarqueeSchema = z.object({
  enabled: z.boolean(),
  text: z.string().trim().min(1).max(500),
});

export const VitrineServiceImagesSchema = z.object({
  roomService: z.string().nullable(),
  afterwork: z.string().nullable(),
  conciergerie: z.string().nullable(),
});

export const VitrineContentResponseSchema = z.object({
  heroImages: z.array(z.string()),
  conceptImage: z.string().nullable(),
  serviceImages: VitrineServiceImagesSchema,
  marquee: VitrineMarqueeSchema,
});

export const UpdateVitrineContentRequestSchema = z.object({
  marquee: VitrineMarqueeSchema.partial().optional(),
  heroImages: z.array(z.string()).optional(),
});

export const HomePublicContentSchema = z.object({
  heroImages: z.array(z.string()),
  conceptImage: z.string().nullable(),
  serviceImages: VitrineServiceImagesSchema,
  marquee: VitrineMarqueeSchema,
});

export type VitrineMarquee = z.infer<typeof VitrineMarqueeSchema>;
export type VitrineServiceImages = z.infer<typeof VitrineServiceImagesSchema>;
export type VitrineContentResponse = z.infer<typeof VitrineContentResponseSchema>;
export type UpdateVitrineContentRequest = z.infer<typeof UpdateVitrineContentRequestSchema>;
export type HomePublicContent = z.infer<typeof HomePublicContentSchema>;

export function isValidVitrineImageStorageKey(storageKey: string): boolean {
  return VITRINE_IMAGE_STORAGE_KEY_PATTERN.test(storageKey);
}

export function buildVitrineImageStorageKey(slot: VitrineImageSlot, fileId: string): string {
  return `vitrine/${slot}/${fileId}.webp`;
}

export function mediaPathFromVitrineStorageKey(storageKey: string): string {
  return `/media/${storageKey}`;
}

export const DEFAULT_VITRINE_MARQUEE_TEXT =
  "Le Tramway T9 arrive au pied de l'immeuble à la fin de l'automne 2026";

export const DEFAULT_HOME_PUBLIC_CONTENT: HomePublicContent = {
  heroImages: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80",
  ],
  conceptImage:
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
  serviceImages: {
    roomService:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    afterwork:
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    conciergerie:
      "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80",
  },
  marquee: {
    enabled: true,
    text: DEFAULT_VITRINE_MARQUEE_TEXT,
  },
};
