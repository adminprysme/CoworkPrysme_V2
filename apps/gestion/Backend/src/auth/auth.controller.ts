/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  GESTION_SESSION_COOKIE,
  LocalLoginRequestSchema,
  SsoLoginRequestSchema,
} from "@coworkprysme/shared";
import type { Request, Response } from "express";

import { AuthService } from "./auth.service.js";
import { SessionGuard } from "./session.guard.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async loginLocal(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = LocalLoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.auth.loginLocal(parsed.data, req.cookies[GESTION_SESSION_COOKIE], res);
  }

  @Post("sso")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async loginSso(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = SsoLoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException();
    }
    return this.auth.loginSso(parsed.data.sso_token, req.cookies[GESTION_SESSION_COOKIE], res);
  }

  @Get("me")
  @UseGuards(SessionGuard)
  async me(@Req() req: Request) {
    return this.auth.me(req.cookies[GESTION_SESSION_COOKIE]);
  }

  @Post("logout")
  @UseGuards(SessionGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req.cookies[GESTION_SESSION_COOKIE], res);
  }
}
