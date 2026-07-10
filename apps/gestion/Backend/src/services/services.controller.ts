import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { CreateServiceRequestSchema, UpdateServiceRequestSchema } from "@coworkprysme/shared";
import type { Request } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { SessionGuard } from "../auth/session.guard.js";
import { ServicesPermissionGuard } from "../auth/services-permission.guard.js";
import { ServicesService } from "./services.service.js";

@Controller("services")
@UseGuards(SessionGuard, ServicesPermissionGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  async list(@Query("status") status: string | undefined) {
    const normalized =
      status === "active" || status === "inactive" || status === "all" ? status : "all";
    return this.services.list(normalized);
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    return this.services.getById(id);
  }

  @Post()
  async create(@Body() body: unknown) {
    const parsed = CreateServiceRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.services.create(parsed.data);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown, @Req() _request: Request) {
    const parsed = UpdateServiceRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.services.update(id, parsed.data);
  }
}
