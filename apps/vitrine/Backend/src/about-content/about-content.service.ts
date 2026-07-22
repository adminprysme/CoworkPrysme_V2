import { Injectable } from "@nestjs/common";
import { connectMongo, getVitrineContentModel } from "@coworkprysme/db";
import { VITRINE_CONTENT_SINGLETON_ID } from "@coworkprysme/shared";

import { mergeAboutPublicContent } from "./about-content.controller.js";

@Injectable()
export class AboutContentService {
  private getApiOrigin(): string {
    const port = Number(process.env.PORT ?? 8002);
    return process.env.VITRINE_API_PUBLIC_ORIGIN?.replace(/\/$/, "") ?? `http://localhost:${port}`;
  }

  async getPublicContent() {
    await connectMongo();
    const VitrineContent = await getVitrineContentModel();
    const doc = await VitrineContent.findById(VITRINE_CONTENT_SINGLETON_ID).lean().exec();

    return mergeAboutPublicContent(
      {
        placeImage: doc?.placeImage ?? null,
      },
      this.getApiOrigin(),
    );
  }
}
