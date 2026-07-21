import { BadRequestException, Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import {
  StaffDeactivateClientAccountRequestSchema,
  StaffReactivateClientAccountRequestSchema,
  StaffTransferCardexOwnershipRequestSchema,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { ClientsPermissionGuard } from "../auth/clients-permission.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { StaffContextService } from "../auth/staff-context.service.js";
import { ClientAccountsStaffService } from "./client-accounts-staff.service.js";

@Controller("planning/client-accounts")
@UseGuards(SessionGuard, ClientsPermissionGuard)
export class ClientAccountsStaffController {
  constructor(
    private readonly clientAccounts: ClientAccountsStaffService,
    private readonly staffContext: StaffContextService,
  ) {}

  @Post(":id/deactivate")
  async deactivate(@Req() request: Request, @Param("id") id: string, @Body() body: unknown) {
    const parsed = StaffDeactivateClientAccountRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Corps de requête invalide",
        issues: parsed.error.issues,
      });
    }
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.clientAccounts.deactivate(profile, id, parsed.data);
  }

  @Post(":id/reactivate")
  async reactivate(@Req() request: Request, @Param("id") id: string, @Body() body: unknown) {
    const parsed = StaffReactivateClientAccountRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Corps de requête invalide",
        issues: parsed.error.issues,
      });
    }
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.clientAccounts.reactivate(profile, id);
  }
}

@Controller("planning/cardexes")
@UseGuards(SessionGuard, ClientsPermissionGuard)
export class CardexesStaffController {
  constructor(
    private readonly clientAccounts: ClientAccountsStaffService,
    private readonly staffContext: StaffContextService,
  ) {}

  @Post(":id/transfer-ownership")
  async transferOwnership(@Req() request: Request, @Param("id") id: string, @Body() body: unknown) {
    const parsed = StaffTransferCardexOwnershipRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Corps de requête invalide",
        issues: parsed.error.issues,
      });
    }
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.clientAccounts.transferOwnership(profile, id, parsed.data);
  }
}
