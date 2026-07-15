import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { CreateServiceRequestSchema, UpdateServiceRequestSchema } from "@coworkprysme/shared";
import { parseGestionApiEnv } from "@coworkprysme/shared/server";
import type { Request } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { SessionGuard } from "../auth/session.guard.js";
import { ServicesPermissionGuard } from "../auth/services-permission.guard.js";
import { StaffContextService } from "../auth/staff-context.service.js";
import { ServicesService } from "./services.service.js";

function uploadLimits() {
  const env = parseGestionApiEnv();
  return { fileSize: env.UPLOAD_MAX_BYTES_SERVICE };
}

@Controller("services")
@UseGuards(SessionGuard, ServicesPermissionGuard)
export class ServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly staffContext: StaffContextService,
  ) {}

  @Get()
  async list(@Query("status") status: string | undefined, @Req() request: Request) {
    const normalized =
      status === "active" || status === "inactive" || status === "all" ? status : "all";
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.services.list(profile, normalized);
  }

  @Get(":id")
  async getById(@Param("id") id: string, @Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.services.getById(id, profile);
  }

  @Post()
  async create(@Body() body: unknown, @Req() request: Request) {
    const parsed = CreateServiceRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.services.create(parsed.data, profile);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown, @Req() request: Request) {
    const parsed = UpdateServiceRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    const requestedKeys =
      body !== null && typeof body === "object" ? Object.keys(body as Record<string, unknown>) : [];
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.services.update(id, parsed.data, profile, requestedKeys);
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.services.delete(id, profile);
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
    return this.services.uploadPhoto(id, file.buffer, profile);
  }

  @Delete(":id/photos")
  async deletePhoto(@Param("id") id: string, @Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.services.deletePhoto(id, profile);
  }
}
