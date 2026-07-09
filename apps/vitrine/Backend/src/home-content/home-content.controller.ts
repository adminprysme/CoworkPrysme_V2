import { Controller, Get } from "@nestjs/common";
import {
  DEFAULT_HOME_PUBLIC_CONTENT,
  HomePublicContentSchema,
  mediaPathFromVitrineStorageKey,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { HomeContentService } from "./home-content.service.js";

@Controller("home-content")
export class HomeContentController {
  constructor(private readonly homeContent: HomeContentService) {}

  @Get()
  async getHomeContent() {
    const payload = await this.homeContent.getPublicContent();
    return HomePublicContentSchema.parse(payload);
  }
}

export function buildPublicImageUrl(
  storageKey: string | null,
  fallback: string,
  apiOrigin: string,
): string {
  if (!storageKey) {
    return fallback;
  }
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return storageKey;
  }
  return `${apiOrigin}${mediaPathFromVitrineStorageKey(storageKey)}`;
}

export function mergeHomePublicContent(
  stored: {
    heroImages: string[];
    conceptImage: string | null;
    serviceImages: {
      roomService: string | null;
      afterwork: string | null;
      conciergerie: string | null;
    };
    marquee: { enabled: boolean; text: string };
  },
  apiOrigin: string,
) {
  const defaults = DEFAULT_HOME_PUBLIC_CONTENT;

  const heroImages =
    stored.heroImages.length > 0
      ? stored.heroImages.map((key) => buildPublicImageUrl(key, defaults.heroImages[0]!, apiOrigin))
      : defaults.heroImages;

  return {
    heroImages,
    conceptImage: buildPublicImageUrl(stored.conceptImage, defaults.conceptImage!, apiOrigin),
    serviceImages: {
      roomService: buildPublicImageUrl(
        stored.serviceImages.roomService,
        defaults.serviceImages.roomService!,
        apiOrigin,
      ),
      afterwork: buildPublicImageUrl(
        stored.serviceImages.afterwork,
        defaults.serviceImages.afterwork!,
        apiOrigin,
      ),
      conciergerie: buildPublicImageUrl(
        stored.serviceImages.conciergerie,
        defaults.serviceImages.conciergerie!,
        apiOrigin,
      ),
    },
    marquee: {
      enabled: stored.marquee.enabled,
      text: stored.marquee.text.trim() || defaults.marquee.text,
    },
  };
}
