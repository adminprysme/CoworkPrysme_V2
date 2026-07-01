import { Injectable, UnauthorizedException } from "@nestjs/common";
import { GESTION_SESSION_COOKIE } from "@coworkprysme/shared";
import { connectMongo, getStaffProfileModel, type StaffProfileDocument } from "@coworkprysme/db";
import type { Request } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { SessionService } from "./session.service.js";

@Injectable()
export class StaffContextService {
  constructor(private readonly sessions: SessionService) {}

  async requireProfileFromRequest(request: Request): Promise<StaffProfileDocument> {
    const rawToken = request.cookies[GESTION_SESSION_COOKIE] as string | undefined;
    const session = await this.sessions.findValidSession(rawToken);
    if (!session) {
      throw new UnauthorizedException();
    }

    await connectMongo();
    const StaffProfile = await getStaffProfileModel();
    const profile = await StaffProfile.findById(session.staffProfileId).exec();
    if (!profile || profile.status === "revoked") {
      throw new UnauthorizedException();
    }

    return profile;
  }
}
