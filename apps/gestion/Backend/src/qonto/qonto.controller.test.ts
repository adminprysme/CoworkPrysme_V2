import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QontoController } from "./qonto.controller.js";
import type { QontoAuthService } from "./qonto-auth.service.js";
import type { QontoConfigService } from "./qonto-config.service.js";
import type { QontoSyncService } from "./qonto-sync.service.js";

describe("QontoController OAuth callback", () => {
  let controller: QontoController;
  let auth: { completeAuthorization: ReturnType<typeof vi.fn> };
  let qontoConfig: {
    isEnabled: ReturnType<typeof vi.fn>;
    config: { env: string; pollIntervalMs: number };
  };

  beforeEach(() => {
    auth = {
      completeAuthorization: vi.fn(),
    };
    qontoConfig = {
      isEnabled: vi.fn().mockReturnValue(true),
      config: { env: "sandbox", pollIntervalMs: 600_000 },
    };
    controller = new QontoController(
      auth as unknown as QontoAuthService,
      qontoConfig as unknown as QontoConfigService,
      {} as QontoSyncService,
    );
  });

  it("returns a generic BadRequest message without leaking the underlying error", async () => {
    auth.completeAuthorization.mockRejectedValue(
      new Error("refresh_token leaked-secret-value invalid_grant"),
    );

    const res = {
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await expect(
      controller.callback("auth-code", "csrf-state", undefined, res as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    try {
      await controller.callback("auth-code", "csrf-state", undefined, res as never);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse();
      const message =
        typeof body === "string"
          ? body
          : typeof body === "object" && body && "message" in body
            ? String((body as { message: unknown }).message)
            : "";
      expect(message).toBe("Échec de l'autorisation Qonto");
      expect(message).not.toContain("leaked-secret-value");
      expect(message).not.toContain("invalid_grant");
    }
  });
});
