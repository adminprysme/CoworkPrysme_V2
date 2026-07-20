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
import { PlanningSpaceChangeRequestSchema } from "@coworkprysme/shared";

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
