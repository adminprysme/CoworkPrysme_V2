import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { PlanningPermissionGuard } from "../auth/planning-permission.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { StaffContextService } from "../auth/staff-context.service.js";
import { PlanningService } from "./planning.service.js";

@Controller("planning")
@UseGuards(SessionGuard, PlanningPermissionGuard)
export class PlanningController {
  constructor(
    private readonly planning: PlanningService,
    private readonly staffContext: StaffContextService,
  ) {}

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
