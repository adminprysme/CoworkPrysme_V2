import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import {
  PlanningCancelRequestSchema,
  PlanningContactTransferRequestSchema,
  PlanningDateChangeRequestSchema,
  PlanningPartySizeRequestSchema,
  PlanningRestoreRequestSchema,
  PlanningSpaceChangeRequestSchema,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { PlanningPermissionGuard } from "../auth/planning-permission.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { StaffContextService } from "../auth/staff-context.service.js";
import { PlanningManageService } from "./planning-manage.service.js";
import { PlanningService } from "./planning.service.js";

@Controller("planning")
@UseGuards(SessionGuard, PlanningPermissionGuard)
export class PlanningController {
  constructor(
    private readonly planning: PlanningService,
    private readonly planningManage: PlanningManageService,
    private readonly staffContext: StaffContextService,
  ) {}

  @Get("occupancy")
  async occupancy(@Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.planning.getOccupancy(profile);
  }

  @Get("search")
  async search(@Req() request: Request, @Query("q") q?: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.planning.search(profile, { q });
  }

  @Get("calendar")
  async calendar(
    @Req() request: Request,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("buildingId") buildingId?: string,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.planning.getCalendar(profile, { from, to, buildingId });
  }

  @Get("reservations/:id/manage/spaces")
  async manageSpaces(@Req() request: Request, @Param("id") id: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.planningManage.listCandidateSpaces(profile, id);
  }

  @Get("reservations/:id/manage/space-change/preview")
  async manageSpaceChangePreview(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("nextSpaceId") nextSpaceId?: string,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    if (!nextSpaceId) {
      throw new BadRequestException({
        code: "MISSING_NEXT_SPACE_ID",
        message: "nextSpaceId requis",
      });
    }
    return this.planningManage.previewSpaceChange(profile, id, nextSpaceId);
  }

  @Post("reservations/:id/manage/space-change")
  async manageSpaceChangeConfirm(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = PlanningSpaceChangeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Payload invalide");
    }
    return this.planningManage.confirmSpaceChange(profile, id, parsed.data);
  }

  @Get("reservations/:id/manage/cancel/preview")
  async manageCancelPreview(@Req() request: Request, @Param("id") id: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.planningManage.previewCancel(profile, id);
  }

  @Post("reservations/:id/manage/cancel")
  async manageCancelConfirm(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = PlanningCancelRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Payload invalide");
    }
    return this.planningManage.confirmCancel(profile, id, parsed.data);
  }

  @Get("reservations/:id/manage/restore/preview")
  async manageRestorePreview(@Req() request: Request, @Param("id") id: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.planningManage.previewRestore(profile, id);
  }

  @Post("reservations/:id/manage/restore")
  async manageRestoreConfirm(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = PlanningRestoreRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Payload invalide");
    }
    return this.planningManage.confirmRestore(profile, id, parsed.data);
  }

  @Get("reservations/:id/manage/date-change/preview")
  async manageDateChangePreview(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("startAt") startAt?: string,
    @Query("endAt") endAt?: string,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    if (!startAt || !endAt) {
      throw new BadRequestException({
        code: "MISSING_DATE",
        message: "startAt et endAt requis",
      });
    }
    return this.planningManage.previewDateChange(profile, id, startAt, endAt);
  }

  @Post("reservations/:id/manage/date-change")
  async manageDateChangeConfirm(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = PlanningDateChangeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Payload invalide");
    }
    return this.planningManage.confirmDateChange(profile, id, parsed.data);
  }

  @Get("reservations/:id/manage/party-size/preview")
  async managePartySizePreview(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("newPartySize") newPartySize?: string,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsedSize = Number.parseInt(newPartySize ?? "", 10);
    if (!Number.isInteger(parsedSize) || parsedSize <= 0) {
      throw new BadRequestException({
        code: "INVALID_PARTY_SIZE",
        message: "newPartySize doit être un entier positif",
      });
    }
    return this.planningManage.previewPartySize(profile, id, parsedSize);
  }

  @Post("reservations/:id/manage/party-size")
  async managePartySizeConfirm(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = PlanningPartySizeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Payload invalide");
    }
    return this.planningManage.confirmPartySize(profile, id, parsed.data);
  }

  @Get("reservations/:id/manage/contact-transfer/preview")
  async manageContactTransferPreview(
    @Req() request: Request,
    @Param("id") id: string,
    @Query("nextClientAccountId") nextClientAccountId?: string,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    if (!nextClientAccountId) {
      throw new BadRequestException({
        code: "MISSING_NEXT_CLIENT_ACCOUNT_ID",
        message: "nextClientAccountId requis",
      });
    }
    return this.planningManage.previewContactTransfer(profile, id, nextClientAccountId);
  }

  @Post("reservations/:id/manage/contact-transfer")
  async manageContactTransferConfirm(
    @Req() request: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = PlanningContactTransferRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Payload invalide");
    }
    return this.planningManage.confirmContactTransfer(profile, id, parsed.data);
  }

  @Get("reservations/:id")
  async reservationDetail(@Req() request: Request, @Param("id") id: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.planning.getReservationDetail(profile, id);
  }

  @Get("spaces/:spaceId/history")
  async spaceHistory(
    @Req() request: Request,
    @Param("spaceId") spaceId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("types") types?: string,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.planning.getSpaceHistory(profile, spaceId, { from, to, types });
  }
}
