import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { VITRINE_UPLOAD_MAX_BYTES } from "@coworkprysme/shared";
import { memoryStorage } from "multer";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { AdminGuard } from "../auth/admin.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { VitrineContentService } from "./vitrine-content.service.js";

function uploadLimits() {
  return { fileSize: VITRINE_UPLOAD_MAX_BYTES };
}

@Controller("admin/vitrine-content")
@UseGuards(SessionGuard, AdminGuard)
export class VitrineContentController {
  constructor(private readonly vitrineContent: VitrineContentService) {}

  @Get()
  getContent() {
    return this.vitrineContent.getContent();
  }

  @Patch()
  updateContent(@Body() body: unknown) {
    return this.vitrineContent.updateContent(body);
  }

  @Post("images/:slot")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: uploadLimits(),
    }),
  )
  uploadImage(@Param("slot") slot: string, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Missing file");
    }
    return this.vitrineContent.uploadImage(slot, file.buffer);
  }

  @Delete("images/:slot/:filename")
  deleteImage(@Param("slot") slot: string, @Param("filename") filename: string) {
    return this.vitrineContent.deleteImage(slot, filename);
  }
}
