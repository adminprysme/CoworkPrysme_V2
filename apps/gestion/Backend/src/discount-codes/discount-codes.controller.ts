import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CreateDiscountCodeRequestSchema,
  UpdateDiscountCodeRequestSchema,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { SessionGuard } from "../auth/session.guard.js";
import { PromoPermissionGuard } from "../auth/promo-permission.guard.js";
import { DiscountCodesService } from "./discount-codes.service.js";

@Controller("discount-codes")
@UseGuards(SessionGuard, PromoPermissionGuard)
export class DiscountCodesController {
  constructor(private readonly discountCodes: DiscountCodesService) {}

  @Get()
  async list() {
    return this.discountCodes.list();
  }

  @Get("service-options")
  async listServiceOptions() {
    return { services: await this.discountCodes.listServiceOptions() };
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    return this.discountCodes.getById(id);
  }

  @Post()
  async create(@Body() body: unknown) {
    const parsed = CreateDiscountCodeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid payload");
    }
    return this.discountCodes.create(parsed.data);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const parsed = UpdateDiscountCodeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid payload");
    }
    return this.discountCodes.update(id, parsed.data);
  }
}
