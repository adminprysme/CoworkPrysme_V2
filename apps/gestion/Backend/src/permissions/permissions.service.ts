import { Injectable } from "@nestjs/common";
import {
  PermissionsCompaniesResponseSchema,
  PermissionsSecteursResponseSchema,
  PermissionsUsersResponseSchema,
  type PermissionsCompaniesResponse,
  type PermissionsPageSize,
  type PermissionsStaffRole,
  type PermissionsSecteursResponse,
  type PermissionsUsersResponse,
} from "@coworkprysme/shared";
import { connectMongo, getStaffProfileModel } from "@coworkprysme/db";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { PrysmaDirectoryReadService } from "./prysma-directory.read.service.js";

@Injectable()
export class PermissionsService {
  constructor(private readonly prysmaDirectory: PrysmaDirectoryReadService) {}

  async listCompanies(): Promise<PermissionsCompaniesResponse> {
    const companies = await this.prysmaDirectory.listCompanies();
    return PermissionsCompaniesResponseSchema.parse({ companies });
  }

  async listSecteurs(companyId: string): Promise<PermissionsSecteursResponse> {
    const secteurs = await this.prysmaDirectory.listSecteurs(companyId);
    return PermissionsSecteursResponseSchema.parse({ secteurs });
  }

  async listUsers(filters: {
    companyId?: string;
    secteurId?: string;
    search?: string;
    page: number;
    pageSize: PermissionsPageSize;
  }): Promise<PermissionsUsersResponse> {
    const { users, total } = await this.prysmaDirectory.listUsers(filters);
    const roleByUserId = await this.loadGestionRoles(users.map((user) => user.id));

    const enriched = users.map((user) => ({
      ...user,
      role: roleByUserId.get(user.id) ?? "none",
    }));

    const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

    return PermissionsUsersResponseSchema.parse({
      users: enriched,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages,
      },
    });
  }

  private async loadGestionRoles(prysmAppUserIds: string[]) {
    if (prysmAppUserIds.length === 0) {
      return new Map<string, PermissionsStaffRole>();
    }

    await connectMongo();
    const StaffProfile = await getStaffProfileModel();
    const profiles = await StaffProfile.find({
      prysmAppUserId: { $in: prysmAppUserIds },
      status: "active",
    })
      .select({ prysmAppUserId: 1, role: 1 })
      .lean()
      .exec();

    return new Map(
      profiles.map((profile) => [profile.prysmAppUserId, profile.role as PermissionsStaffRole]),
    );
  }
}
