import { Injectable } from "@nestjs/common";
import { connectMongo, getVitrineContentModel } from "@coworkprysme/db";
import { DEFAULT_VITRINE_MARQUEE_TEXT, VITRINE_CONTENT_SINGLETON_ID } from "@coworkprysme/shared";

import { mergeHomePublicContent } from "./home-content.controller.js";

@Injectable()
export class HomeContentService {
  private getApiOrigin(): string {
    const port = Number(process.env.PORT ?? 8002);
    return process.env.VITRINE_API_PUBLIC_ORIGIN?.replace(/\/$/, "") ?? `http://localhost:${port}`;
  }

  async getPublicContent() {
    await connectMongo();
    const VitrineContent = await getVitrineContentModel();
    const doc = await VitrineContent.findById(VITRINE_CONTENT_SINGLETON_ID).lean().exec();

    if (!doc) {
      return mergeHomePublicContent(
        {
          heroImages: [],
          conceptImage: null,
          serviceImages: {
            roomService: null,
            afterwork: null,
            conciergerie: null,
          },
          marquee: {
            enabled: true,
            text: DEFAULT_VITRINE_MARQUEE_TEXT,
          },
        },
        this.getApiOrigin(),
      );
    }

    return mergeHomePublicContent(
      {
        heroImages: doc.heroImages,
        conceptImage: doc.conceptImage,
        serviceImages: doc.serviceImages,
        marquee: doc.marquee,
      },
      this.getApiOrigin(),
    );
  }
}
