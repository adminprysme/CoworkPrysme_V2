/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { Injectable } from "@nestjs/common";
import {
  CentraleValidateSsoResponseSchema,
  type CentraleValidatedUser,
} from "@coworkprysme/shared";

import { AuthConfigService } from "./auth-config.service.js";

@Injectable()
export class CentraleClient {
  constructor(private readonly config: AuthConfigService) {}

  async validateSsoToken(ssoToken: string): Promise<CentraleValidatedUser> {
    const baseUrl = this.config.env.CENTRALE_API_URL;
    if (!baseUrl) {
      throw new Error("CENTRALE_API_URL is not configured");
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/validate-sso-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sso_token: ssoToken }),
    });

    if (!response.ok) {
      throw new Error("SSO_INVALID");
    }

    const payload: unknown = await response.json();
    const parsed = CentraleValidateSsoResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("SSO_INVALID");
    }

    return parsed.data.user;
  }
}
