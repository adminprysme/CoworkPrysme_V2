import { Controller, Get, Param, Res } from "@nestjs/common";
import { createReadStream } from "node:fs";
import type { Response } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { UploadsService } from "./uploads.service.js";

@Controller("media")
export class MediaController {
  constructor(private readonly uploads: UploadsService) {}

  @Get("buildings/:buildingId/:filename")
  async serveBuildingPhoto(
    @Param("buildingId") buildingId: string,
    @Param("filename") filename: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.servePhoto(`buildings/${buildingId}/${filename}`, response);
  }

  @Get("spaces/:spaceId/:filename")
  async serveSpacePhoto(
    @Param("spaceId") spaceId: string,
    @Param("filename") filename: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.servePhoto(`spaces/${spaceId}/${filename}`, response);
  }

  private async servePhoto(storageKey: string, response: Response): Promise<void> {
    const absolutePath = await this.uploads.assertReadableFile(storageKey);

    response.setHeader("Content-Type", "image/webp");
    response.setHeader("Cache-Control", "public, max-age=86400, immutable");
    response.setHeader("X-Content-Type-Options", "nosniff");

    const stream = createReadStream(absolutePath);
    stream.on("error", () => {
      if (!response.headersSent) {
        response.status(404).end();
        return;
      }
      response.destroy();
    });
    stream.pipe(response);
  }
}
