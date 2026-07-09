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
export const VITRINE_FEATURED_SPACES_MAX = 3;
export const VITRINE_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

export const VitrineFeaturedSpaceIdSchema = z.string().regex(/^[a-f0-9]{24}$/i);

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
  featuredSpaceIds: z.array(VitrineFeaturedSpaceIdSchema),
  marquee: VitrineMarqueeSchema,
});

export const UpdateVitrineContentRequestSchema = z.object({
  marquee: VitrineMarqueeSchema.partial().optional(),
  heroImages: z.array(z.string()).optional(),
  featuredSpaceIds: z
    .array(VitrineFeaturedSpaceIdSchema)
    .max(VITRINE_FEATURED_SPACES_MAX)
    .optional(),
});

export const ServicesFeaturedSpaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["meeting_room", "private_office"]),
  capacity: z.number().int().min(1),
  description: z.string(),
  equipment: z.array(z.string()),
  href: z.string(),
  image: z.string(),
});

export const ServicesPublicContentSchema = z.object({
  featuredSpaces: z.array(ServicesFeaturedSpaceSchema),
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
export type ServicesFeaturedSpace = z.infer<typeof ServicesFeaturedSpaceSchema>;
export type ServicesPublicContent = z.infer<typeof ServicesPublicContentSchema>;

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

export const DEFAULT_SERVICES_FEATURED_SPACES: ServicesFeaturedSpace[] = [
  {
    id: "mock-bureau-gerland",
    name: "Bureau Privatif Gerland",
    type: "private_office",
    capacity: 4,
    description:
      "Bureau lumineux avec postes individuels, idéal pour une équipe en croissance ou un dirigeant recherchant calme et confidentialité.",
    equipment: ["Fibre", "Climatisation", "Armoire", "Table de réunion"],
    href: "/bureaux-privatifs",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "mock-boardroom",
    name: "Salle Boardroom",
    type: "meeting_room",
    capacity: 12,
    description:
      "Salle de réunion équipée pour comités de direction, visioconférences et sessions de travail en petit comité.",
    equipment: ["Écran 4K", "Visio", "Table modulable", "Paperboard"],
    href: "/salle-de-reunion",
    image:
      "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "mock-atelier",
    name: "Salle Atelier Formation",
    type: "meeting_room",
    capacity: 20,
    description:
      "Volume généreux en disposition classe ou U, pensé pour formations, workshops et séminaires d'une journée.",
    equipment: ["Vidéoprojecteur", "Sonorisation", "Tables modulables", "Lumière du jour"],
    href: "/salle-de-reunion",
    image:
      "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=900&q=80",
  },
];

export const DEFAULT_SERVICES_PUBLIC_CONTENT: ServicesPublicContent = {
  featuredSpaces: DEFAULT_SERVICES_FEATURED_SPACES,
};

export function spaceTypeToVitrineHref(type: ServicesFeaturedSpace["type"]): string {
  return type === "private_office" ? "/bureaux-privatifs" : "/salle-de-reunion";
}

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
