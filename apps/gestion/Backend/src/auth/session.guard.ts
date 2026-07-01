/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { GESTION_SESSION_COOKIE } from "@coworkprysme/shared";
import type { Request } from "express";

import { SessionService } from "./session.service.js";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawToken = request.cookies[GESTION_SESSION_COOKIE] as string | undefined;
    const session = await this.sessions.findValidSession(rawToken);
    if (!session) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
