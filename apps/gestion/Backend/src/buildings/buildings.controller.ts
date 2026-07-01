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
import {
  CreateBuildingRequestSchema,
  UpdateBuildingRequestSchema,
  parseGestionApiEnv,
} from "@coworkprysme/shared";
import type { Request } from "express";
import { memoryStorage } from "multer";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { SessionGuard } from "../auth/session.guard.js";
import { SpacesPermissionGuard } from "../auth/spaces-permission.guard.js";
import { StaffContextService } from "../auth/staff-context.service.js";
import { BuildingsService } from "./buildings.service.js";

function uploadLimits() {
  const env = parseGestionApiEnv();
  return { fileSize: env.UPLOAD_MAX_BYTES };
}

@Controller("buildings")
@UseGuards(SessionGuard, SpacesPermissionGuard)
export class BuildingsController {
  constructor(
    private readonly buildings: BuildingsService,
    private readonly staffContext: StaffContextService,
  ) {}

  @Get()
  async list(@Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.buildings.list(profile);
  }

  @Get(":id")
  async getById(@Param("id") id: string, @Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.buildings.getById(id, profile);
  }

  @Post()
  async create(@Body() body: unknown, @Req() request: Request) {
    const parsed = CreateBuildingRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.buildings.create(parsed.data, profile);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown, @Req() request: Request) {
    const parsed = UpdateBuildingRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.buildings.update(id, parsed.data, profile);
  }

  @Post(":id/photos")
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
    return this.buildings.uploadPhoto(id, file.buffer, profile);
  }

  @Patch(":id/photos")
  async updatePhotos(@Param("id") id: string, @Body() body: unknown, @Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.buildings.updatePhotos(id, body, profile);
  }

  @Delete(":id/photos/:filename")
  async deletePhoto(
    @Param("id") id: string,
    @Param("filename") filename: string,
    @Req() request: Request,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.buildings.deletePhoto(id, `buildings/${id}/${filename}`, profile);
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    await this.buildings.delete(id, profile);
    return { ok: true };
  }
}
