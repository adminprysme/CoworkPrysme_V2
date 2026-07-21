import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { StaffContextService } from "./staff-context.service.js";

/**
 * Guards staff routes that act on cardex / client accounts globally.
 * Requires permissions.clients — no building/reservation scope filter.
 */
@Injectable()
export class ClientsPermissionGuard implements CanActivate {
  constructor(private readonly staffContext: StaffContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const profile = await this.staffContext.requireProfileFromRequest(request);
    if (!profile.permissions.clients) {
      throw new ForbiddenException();
    }
    return true;
  }
}
