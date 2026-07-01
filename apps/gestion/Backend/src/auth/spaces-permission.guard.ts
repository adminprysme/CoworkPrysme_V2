/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";

import { StaffContextService } from "./staff-context.service.js";

@Injectable()
export class SpacesPermissionGuard implements CanActivate {
  constructor(private readonly staffContext: StaffContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const profile = await this.staffContext.requireProfileFromRequest(request);
    if (!profile.permissions.spaces) {
      throw new ForbiddenException();
    }
    return true;
  }
}
