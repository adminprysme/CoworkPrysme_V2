import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { PlanningCreateInvitationRequestSchema } from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { ClientsPermissionGuard } from "../auth/clients-permission.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { StaffContextService } from "../auth/staff-context.service.js";
import { PlanningInvitationsService } from "./planning-invitations.service.js";

/**
 * Invitation staff routes — cardex-global via ClientsPermissionGuard
 * (same model as documents / deactivate / transfer). Not PlanningPermissionGuard:
 * UI Contacts already gates on permissions.clients.
 */
@Controller("planning")
@UseGuards(SessionGuard, ClientsPermissionGuard)
export class PlanningInvitationsController {
  constructor(
    private readonly planningInvitations: PlanningInvitationsService,
    private readonly staffContext: StaffContextService,
  ) {}

  @Get("reservations/:id/invitations")
  async listInvitations(@Req() request: Request, @Param("id") id: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.planningInvitations.listForReservation(profile, id);
  }

  @Post("reservations/:id/invitations")
  async createInvitation(@Req() request: Request, @Param("id") id: string, @Body() body: unknown) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const parsed = PlanningCreateInvitationRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.planningInvitations.createForReservation(profile, id, parsed.data);
  }

  @Post("invitations/:id/resend")
  async resendInvitation(@Req() request: Request, @Param("id") id: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.planningInvitations.resend(profile, id);
  }

  @Post("invitations/:id/revoke")
  async revokeInvitation(@Req() request: Request, @Param("id") id: string) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.planningInvitations.revoke(profile, id);
  }
}
