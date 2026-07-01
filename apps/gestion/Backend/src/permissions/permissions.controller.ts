/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PermissionsPageSizeSchema, type PermissionsPageSize } from "@coworkprysme/shared";

import { AdminGuard } from "../auth/admin.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { PermissionsService } from "./permissions.service.js";

function parsePage(value?: string): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function parsePageSize(value?: string): PermissionsPageSize {
  const parsed = PermissionsPageSizeSchema.safeParse(Number(value));
  return parsed.success ? parsed.data : 25;
}

@Controller("admin/permissions")
@UseGuards(SessionGuard, AdminGuard)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get("companies")
  listCompanies() {
    return this.permissions.listCompanies();
  }

  @Get("secteurs")
  listSecteurs(@Query("companyId") companyId?: string) {
    if (!companyId?.trim()) {
      throw new BadRequestException("companyId requis");
    }
    return this.permissions.listSecteurs(companyId.trim());
  }

  @Get("users")
  listUsers(
    @Query("companyId") companyId?: string,
    @Query("secteurId") secteurId?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.permissions.listUsers({
      companyId: companyId?.trim() || undefined,
      secteurId: secteurId?.trim() || undefined,
      search: search?.trim() || undefined,
      page: parsePage(page),
      pageSize: parsePageSize(pageSize),
    });
  }
}
