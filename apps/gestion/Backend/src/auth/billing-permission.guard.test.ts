import { ForbiddenException } from "@nestjs/common";
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuotesController } from "../billing/quotes.controller.js";
import { BillingPermissionGuard } from "./billing-permission.guard.js";
import { SessionGuard } from "./session.guard.js";

describe("BillingPermissionGuard", () => {
  let requireProfileFromRequest: ReturnType<typeof vi.fn>;
  let guard: BillingPermissionGuard;

  beforeEach(() => {
    requireProfileFromRequest = vi.fn();
    guard = new BillingPermissionGuard({ requireProfileFromRequest } as never);
  });

  it("returns 403 when staff lacks permissions.billing but has other permissions", async () => {
    requireProfileFromRequest.mockResolvedValue({
      permissions: { billing: false, planning: true, clients: true, buildings: true },
    });
    const context = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows when permissions.billing is true", async () => {
    requireProfileFromRequest.mockResolvedValue({
      permissions: { billing: true, planning: false, clients: false },
    });
    const context = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });
});

describe("QuotesController billing permission on all endpoints", () => {
  const EXPECTED_ROUTES: Array<{ methodName: string; httpMethod: RequestMethod; path: string }> = [
    { methodName: "create", httpMethod: RequestMethod.POST, path: "/" },
    { methodName: "list", httpMethod: RequestMethod.GET, path: "/" },
    { methodName: "getById", httpMethod: RequestMethod.GET, path: ":id" },
    { methodName: "update", httpMethod: RequestMethod.PATCH, path: ":id" },
    { methodName: "deleteDraft", httpMethod: RequestMethod.DELETE, path: ":id" },
    { methodName: "send", httpMethod: RequestMethod.POST, path: ":id/send" },
    { methodName: "refuse", httpMethod: RequestMethod.POST, path: ":id/refuse" },
    { methodName: "expire", httpMethod: RequestMethod.POST, path: ":id/expire" },
  ];

  it("applies SessionGuard + BillingPermissionGuard at controller class level", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, QuotesController) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([SessionGuard, BillingPermissionGuard]));
  });

  it("exposes exactly the 8 quote CRUD/lifecycle endpoints under the class guard", () => {
    for (const route of EXPECTED_ROUTES) {
      const handler = QuotesController.prototype[route.methodName as keyof QuotesController];
      expect(handler, `missing handler ${route.methodName}`).toBeTypeOf("function");
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(route.httpMethod);
      const path = Reflect.getMetadata(PATH_METADATA, handler);
      expect(path === route.path || path === route.path.replace(/^\//, "")).toBe(true);
    }
    expect(EXPECTED_ROUTES).toHaveLength(8);
  });

  it("denies each of the 8 endpoints when billing permission is false (class guard)", async () => {
    const requireProfileFromRequest = vi.fn().mockResolvedValue({
      permissions: { billing: false, planning: true, clients: true },
    });
    const guard = new BillingPermissionGuard({ requireProfileFromRequest } as never);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    };

    for (const route of EXPECTED_ROUTES) {
      await expect(
        guard.canActivate(context as never),
        `${route.methodName} must 403 without billing`,
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
});
