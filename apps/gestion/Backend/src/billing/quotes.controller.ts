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
  UseGuards,
} from "@nestjs/common";
import {
  StaffCreateQuoteRequestSchema,
  StaffQuoteAvailabilityCheckRequestSchema,
  StaffQuoteListQuerySchema,
  StaffQuoteLocksAcquireRequestSchema,
  StaffQuoteLocksSessionRequestSchema,
  StaffUpdateQuoteRequestSchema,
} from "@coworkprysme/shared";
import type { Request } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { BillingPermissionGuard } from "../auth/billing-permission.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { StaffContextService } from "../auth/staff-context.service.js";
import { QuotesLocksService } from "./quotes-locks.service.js";
import { QuotesService } from "./quotes.service.js";

@Controller("billing/quotes")
@UseGuards(SessionGuard, BillingPermissionGuard)
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly quoteLocks: QuotesLocksService,
    private readonly staffContext: StaffContextService,
  ) {}

  @Post()
  async create(@Req() request: Request, @Body() body: unknown) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = StaffCreateQuoteRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.quotes.create(profile, parsed.data);
  }

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    const parsed = StaffQuoteListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Paramètres invalides",
      });
    }
    return this.quotes.list(parsed.data);
  }

  /** Static paths before `:id` so Nest does not treat them as ObjectIds. */
  @Post("availability/check")
  async checkAvailability(@Req() request: Request, @Body() body: unknown) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = StaffQuoteAvailabilityCheckRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.quoteLocks.checkAvailability(profile, parsed.data);
  }

  @Post("locks/acquire")
  async acquireLocks(@Req() request: Request, @Body() body: unknown) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = StaffQuoteLocksAcquireRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.quoteLocks.acquire(profile, parsed.data);
  }

  @Post("locks/refresh")
  async refreshLocks(@Req() request: Request, @Body() body: unknown) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = StaffQuoteLocksSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.quoteLocks.refresh(profile, parsed.data);
  }

  @Post("locks/release")
  async releaseLocks(@Req() request: Request, @Body() body: unknown) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = StaffQuoteLocksSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.quoteLocks.release(profile, parsed.data);
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    return this.quotes.getById(id);
  }

  @Patch(":id")
  async update(@Req() request: Request, @Param("id") id: string, @Body() body: unknown) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = StaffUpdateQuoteRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.quotes.update(profile, id, parsed.data);
  }

  @Delete(":id")
  async deleteDraft(@Req() request: Request, @Param("id") id: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.quotes.deleteDraft(profile, id);
  }

  @Post(":id/send")
  async send(@Req() request: Request, @Param("id") id: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.quotes.send(profile, id);
  }

  @Post(":id/refuse")
  async refuse(@Req() request: Request, @Param("id") id: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.quotes.refuse(profile, id);
  }

  @Post(":id/expire")
  async expire(@Req() request: Request, @Param("id") id: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.quotes.expire(profile, id);
  }
}
