import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI */
import { BillingPermissionGuard } from "../auth/billing-permission.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { QontoAuthService } from "./qonto-auth.service.js";
import { QontoConfigService } from "./qonto-config.service.js";
import { QontoSyncService } from "./qonto-sync.service.js";

@Controller("integrations/qonto")
export class QontoController {
  private readonly logger = new Logger(QontoController.name);

  constructor(
    private readonly auth: QontoAuthService,
    private readonly qontoConfig: QontoConfigService,
    private readonly syncService: QontoSyncService,
  ) {}

  /** Staff-only: start one-time OAuth bootstrap and redirect to Qonto. */
  @Get("authorize")
  @UseGuards(SessionGuard, BillingPermissionGuard)
  async authorize(@Res() res: Response) {
    if (!this.qontoConfig.isEnabled()) {
      throw new ServiceUnavailableException("Intégration Qonto non configurée.");
    }
    const { authorizeUrl } = await this.auth.beginAuthorization();
    return res.redirect(authorizeUrl);
  }

  /** Staff-only JSON: same bootstrap without redirect (for copy-paste). */
  @Get("authorize-url")
  @UseGuards(SessionGuard, BillingPermissionGuard)
  async authorizeUrl() {
    if (!this.qontoConfig.isEnabled()) {
      throw new ServiceUnavailableException("Intégration Qonto non configurée.");
    }
    const { authorizeUrl, state } = await this.auth.beginAuthorization();
    return { authorizeUrl, state };
  }

  /**
   * OAuth redirect callback — no session required (browser lands here after Qonto consent).
   * Validates CSRF state then stores encrypted tokens.
   */
  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.qontoConfig.isEnabled()) {
      throw new ServiceUnavailableException("Intégration Qonto non configurée.");
    }
    if (error) {
      this.logger.warn(`Qonto OAuth error: ${error}`);
      throw new BadRequestException(`Autorisation Qonto refusée: ${error}`);
    }
    if (!code?.trim() || !state?.trim()) {
      throw new BadRequestException("Paramètres code et state requis");
    }

    try {
      await this.auth.completeAuthorization(code.trim(), state.trim());
    } catch (err) {
      this.logger.error(
        `Qonto OAuth callback failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException(
        err instanceof Error ? err.message : "Échec de l'autorisation Qonto",
      );
    }

    res
      .status(200)
      .type("html")
      .send(
        `<!doctype html><html lang="fr"><body style="font-family:sans-serif;padding:2rem">
        <h1>Qonto connecté</h1>
        <p>Les jetons ont été enregistrés. Vous pouvez fermer cette fenêtre et revenir à la gestion.</p>
        </body></html>`,
      );
  }

  @Get("status")
  @UseGuards(SessionGuard, BillingPermissionGuard)
  async status() {
    const configured = this.qontoConfig.isEnabled();
    const authorized = configured ? await this.auth.hasStoredCredentials() : false;
    return {
      configured,
      authorized,
      env: this.qontoConfig.config.env,
      pollIntervalMs: this.qontoConfig.config.pollIntervalMs,
    };
  }

  /** Staff-only: force a credit sync now (same logic as the 10-minute poller). */
  @Post("sync")
  @UseGuards(SessionGuard, BillingPermissionGuard)
  async sync() {
    if (!this.qontoConfig.isEnabled()) {
      throw new ServiceUnavailableException("Intégration Qonto non configurée.");
    }
    return this.syncService.syncRecentCredits();
  }
}
