/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
  AuthMeResponseSchema,
  GESTION_SESSION_COOKIE,
  hasGestionAccess,
  type AuthMeResponse,
  type AuthSource,
  type CentraleValidatedUser,
  type LocalLoginRequest,
  type LogoutResponse,
} from "@coworkprysme/shared";
import { connectMongo, getStaffProfileModel, type StaffProfileDocument } from "@coworkprysme/db";
import type { Response } from "express";

import { AuthConfigService } from "./auth-config.service.js";
import { CentraleClient } from "./centrale.client.js";
import { PrysmaUserReadService } from "./prysma-user.read.service.js";
import { SessionService } from "./session.service.js";
import { StaffBootstrapService } from "./staff-bootstrap.service.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly config: AuthConfigService,
    private readonly sessions: SessionService,
    private readonly staffBootstrap: StaffBootstrapService,
    private readonly centrale: CentraleClient,
    private readonly prysmaRead: PrysmaUserReadService,
  ) {}

  setSessionCookie(res: Response, token: string): void {
    res.cookie(GESTION_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.config.env.COOKIE_SECURE,
      sameSite: this.config.env.COOKIE_SAME_SITE,
      maxAge: this.sessions.getTtlMs(),
      path: "/",
    });
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie(GESTION_SESSION_COOKIE, {
      httpOnly: true,
      secure: this.config.env.COOKIE_SECURE,
      sameSite: this.config.env.COOKIE_SAME_SITE,
      path: "/",
    });
  }

  async loginLocal(
    body: LocalLoginRequest,
    existingRawToken: string | undefined,
    res: Response,
  ): Promise<AuthMeResponse> {
    if (this.config.env.AUTH_MODE !== "local") {
      throw new NotFoundException();
    }

    const user = await this.prysmaRead.validateLocalCredentials(body.username, body.password);
    if (!user) {
      throw new UnauthorizedException("Identifiants invalides");
    }

    return this.establishSession(user, "local", existingRawToken, res);
  }

  async loginSso(
    ssoToken: string,
    existingRawToken: string | undefined,
    res: Response,
  ): Promise<AuthMeResponse> {
    if (this.config.env.AUTH_MODE !== "sso") {
      throw new NotFoundException();
    }

    let user: CentraleValidatedUser;
    try {
      user = await this.centrale.validateSsoToken(ssoToken);
    } catch {
      throw new UnauthorizedException("Session expirée, reconnectez-vous via Centrale");
    }

    return this.establishSession(user, "sso", existingRawToken, res);
  }

  async me(sessionToken: string | undefined): Promise<AuthMeResponse> {
    const session = await this.sessions.findValidSession(sessionToken);
    if (!session) {
      throw new UnauthorizedException();
    }

    await connectMongo();
    const StaffProfile = await getStaffProfileModel();
    const profile = await StaffProfile.findById(session.staffProfileId).exec();
    if (!profile || profile.status === "revoked" || !hasGestionAccess(profile.role)) {
      throw new UnauthorizedException();
    }

    return this.buildMeResponse(profile, session.authSource);
  }

  async logout(sessionToken: string | undefined, res: Response): Promise<LogoutResponse> {
    const session = await this.sessions.findValidSession(sessionToken);
    const authSource: AuthSource = session?.authSource ?? "local";

    await this.sessions.destroyByRawToken(sessionToken);
    this.clearSessionCookie(res);

    return {
      redirectUrl: this.resolveLogoutRedirect(authSource),
    };
  }

  private async establishSession(
    user: CentraleValidatedUser,
    authSource: AuthSource,
    existingRawToken: string | undefined,
    res: Response,
  ): Promise<AuthMeResponse> {
    await this.sessions.destroyByRawToken(existingRawToken);

    let profile: StaffProfileDocument;
    try {
      profile = await this.staffBootstrap.upsertFromCentraleUser(user);
    } catch (error) {
      if (error instanceof Error && error.message === "STAFF_REVOKED") {
        throw new UnauthorizedException("Identifiants invalides");
      }
      if (error instanceof Error && error.message === "STAFF_NO_ACCESS") {
        throw new UnauthorizedException("Aucun accès à la gestion");
      }
      throw error;
    }

    const { token } = await this.sessions.createSession(
      profile._id,
      profile.prysmAppUserId,
      authSource,
    );
    this.setSessionCookie(res, token);

    return this.buildMeResponse(profile, authSource);
  }

  private async buildMeResponse(
    profile: StaffProfileDocument,
    authSource: AuthSource,
  ): Promise<AuthMeResponse> {
    if (!hasGestionAccess(profile.role)) {
      throw new UnauthorizedException();
    }

    const enrichment = await this.prysmaRead.findEnrichment(profile.prysmAppUserId);

    const response = AuthMeResponseSchema.parse({
      profile: {
        id: profile._id.toString(),
        prysmAppUserId: profile.prysmAppUserId,
        displayName: profile.displayName,
        email: profile.email,
        role: profile.role,
        permissions: profile.permissions,
        scope: {
          buildingIds: profile.scope.buildingIds.map(String),
          spaceTypes: profile.scope.spaceTypes,
        },
        status: profile.status,
      },
      authSource,
      enrichment,
    });

    return response;
  }

  private resolveLogoutRedirect(authSource: AuthSource): string {
    if (authSource === "sso") {
      return (
        this.config.env.CENTRALE_HOME_URL ??
        this.config.env.CENTRALE_API_URL?.replace(/\/api\/?$/, "") ??
        "/login"
      );
    }
    return "/login";
  }
}
