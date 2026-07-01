/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import {
  connectMongo,
  getStaffSessionModel,
  type StaffSessionAuthSource,
  type StaffSessionDocument,
} from "@coworkprysme/db";
import type { Types } from "mongoose";

import { AuthConfigService } from "./auth-config.service.js";

@Injectable()
export class SessionService {
  constructor(private readonly config: AuthConfigService) {}

  hashToken(token: string): string {
    return createHash("sha256").update(`${token}:${this.config.env.SESSION_SECRET}`).digest("hex");
  }

  generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  getTtlMs(): number {
    return this.config.env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  }

  async destroyByRawToken(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }
    await connectMongo();
    const StaffSession = await getStaffSessionModel();
    await StaffSession.deleteOne({ sessionTokenHash: this.hashToken(rawToken) });
  }

  async createSession(
    staffProfileId: Types.ObjectId,
    prysmAppUserId: string,
    authSource: StaffSessionAuthSource,
  ): Promise<{ token: string; session: StaffSessionDocument }> {
    await connectMongo();
    const StaffSession = await getStaffSessionModel();
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + this.getTtlMs());
    const session = await StaffSession.create({
      sessionTokenHash: this.hashToken(token),
      staffProfileId,
      prysmAppUserId,
      authSource,
      expiresAt,
    });
    return { token, session };
  }

  async findValidSession(rawToken: string | undefined): Promise<StaffSessionDocument | null> {
    if (!rawToken) {
      return null;
    }
    await connectMongo();
    const StaffSession = await getStaffSessionModel();
    const session = await StaffSession.findOne({
      sessionTokenHash: this.hashToken(rawToken),
      expiresAt: { $gt: new Date() },
    }).exec();
    return session;
  }

  static safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}

export { UnauthorizedException };
