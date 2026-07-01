import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CreateSpaceRequestSchema, UpdateSpaceRequestSchema } from "@coworkprysme/shared";
import { parseGestionApiEnv } from "@coworkprysme/shared/server";
import type { Request } from "express";
import { memoryStorage } from "multer";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { SessionGuard } from "../auth/session.guard.js";
import { SpacesPermissionGuard } from "../auth/spaces-permission.guard.js";
import { StaffContextService } from "../auth/staff-context.service.js";
import { SpacesService } from "./spaces.service.js";

function uploadLimits() {
  const env = parseGestionApiEnv();
  return { fileSize: env.UPLOAD_MAX_BYTES };
}

@Controller()
@UseGuards(SessionGuard, SpacesPermissionGuard)
export class SpacesController {
  constructor(
    private readonly spaces: SpacesService,
    private readonly staffContext: StaffContextService,
  ) {}

  @Get("buildings/:buildingId/spaces")
  async listByBuilding(@Param("buildingId") buildingId: string, @Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.spaces.listByBuilding(buildingId, profile);
  }

  @Post("buildings/:buildingId/spaces")
  async create(
    @Param("buildingId") buildingId: string,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    const parsed = CreateSpaceRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.spaces.create(buildingId, parsed.data, profile);
  }

  @Get("spaces/:id")
  async getById(@Param("id") id: string, @Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.spaces.getById(id, profile);
  }

  @Patch("spaces/:id")
  async update(@Param("id") id: string, @Body() body: unknown, @Req() request: Request) {
    const parsed = UpdateSpaceRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.spaces.update(id, parsed.data, profile);
  }

  @Delete("spaces/:id")
  async delete(@Param("id") id: string, @Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    await this.spaces.delete(id, profile);
    return { ok: true };
  }

  @Post("spaces/:id/photos")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: uploadLimits(),
    }),
  )
  async uploadPhoto(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Missing file");
    }
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.spaces.uploadPhoto(id, file.buffer, profile);
  }

  @Patch("spaces/:id/photos")
  async updatePhotos(@Param("id") id: string, @Body() body: unknown, @Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.spaces.updatePhotos(id, body, profile);
  }

  @Delete("spaces/:id/photos/:filename")
  async deletePhoto(
    @Param("id") id: string,
    @Param("filename") filename: string,
    @Req() request: Request,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.spaces.deletePhoto(id, `spaces/${id}/${filename}`, profile);
  }
}
