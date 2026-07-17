import { Injectable, Logger } from "@nestjs/common";
import {
  connectMongo,
  getQontoOAuthCredentialModel,
  QONTO_OAUTH_SINGLETON_KEY,
} from "@coworkprysme/db";
import { createHash, randomBytes } from "node:crypto";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI */
import { decryptSecret, encryptSecret } from "./qonto-crypto.js";
import { QontoConfigService } from "./qonto-config.service.js";
import { QONTO_OAUTH_SCOPES } from "./qonto-endpoints.js";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  token_type: string;
  scope?: string;
}

const ACCESS_SKEW_MS = 60_000;
const OAUTH_STATE_TTL_MS = 15 * 60_000;
const DEFAULT_REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class QontoAuthService {
  private readonly logger = new Logger(QontoAuthService.name);
  private refreshChain: Promise<string> | null = null;

  constructor(private readonly qontoConfig: QontoConfigService) {}

  /** Build the one-time authorize URL and persist CSRF state. */
  async beginAuthorization(): Promise<{ authorizeUrl: string; state: string }> {
    this.assertConfigured();
    const state = randomBytes(24).toString("hex");
    await connectMongo();
    const Model = await getQontoOAuthCredentialModel();
    const existing = await Model.findOne({ key: QONTO_OAUTH_SINGLETON_KEY }).exec();
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

    if (existing) {
      existing.pendingOAuthState = state;
      existing.pendingOAuthStateExpiresAt = expiresAt;
      // Placeholder ciphertext if tokens not yet present — keep required fields valid.
      if (!existing.accessTokenEnc) {
        existing.accessTokenEnc = encryptSecret("pending", this.qontoConfig.config.encryptionKey);
        existing.refreshTokenEnc = encryptSecret("pending", this.qontoConfig.config.encryptionKey);
        existing.accessTokenExpiresAt = new Date(0);
        existing.refreshTokenExpiresAt = new Date(0);
      }
      await existing.save();
    } else {
      await Model.create({
        key: QONTO_OAUTH_SINGLETON_KEY,
        accessTokenEnc: encryptSecret("pending", this.qontoConfig.config.encryptionKey),
        refreshTokenEnc: encryptSecret("pending", this.qontoConfig.config.encryptionKey),
        accessTokenExpiresAt: new Date(0),
        refreshTokenExpiresAt: new Date(0),
        pendingOAuthState: state,
        pendingOAuthStateExpiresAt: expiresAt,
      });
    }

    const { endpoints, clientId, redirectUri } = this.qontoConfig.config;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: QONTO_OAUTH_SCOPES,
      state,
    });
    return { authorizeUrl: `${endpoints.authorizeUrl}?${params}`, state };
  }

  async completeAuthorization(code: string, state: string): Promise<void> {
    this.assertConfigured();
    await connectMongo();
    const Model = await getQontoOAuthCredentialModel();
    const doc = await Model.findOne({ key: QONTO_OAUTH_SINGLETON_KEY }).exec();
    if (
      !doc?.pendingOAuthState ||
      !doc.pendingOAuthStateExpiresAt ||
      doc.pendingOAuthStateExpiresAt.getTime() < Date.now()
    ) {
      throw new Error("OAuth state expired or missing — restart bootstrap");
    }
    if (
      doc.pendingOAuthState.length !== state.length ||
      !timingSafeEqualString(doc.pendingOAuthState, state)
    ) {
      throw new Error("Invalid OAuth state");
    }

    const tokens = await this.exchangeToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.qontoConfig.config.redirectUri,
    });
    if (!tokens.refresh_token) {
      throw new Error("Qonto did not return a refresh_token — ensure offline_access scope");
    }

    await this.persistTokens(tokens);
    await Model.updateOne(
      { key: QONTO_OAUTH_SINGLETON_KEY },
      { $unset: { pendingOAuthState: 1, pendingOAuthStateExpiresAt: 1 } },
    ).exec();
    this.logger.log("Qonto OAuth bootstrap completed — tokens stored encrypted");
  }

  async getAccessToken(): Promise<string> {
    this.assertConfigured();
    await connectMongo();
    const Model = await getQontoOAuthCredentialModel();
    const doc = await Model.findOne({ key: QONTO_OAUTH_SINGLETON_KEY }).exec();
    if (!doc) {
      throw new Error("Qonto not authorized — complete OAuth bootstrap first");
    }

    const decryptedAccess = decryptSecret(
      doc.accessTokenEnc,
      this.qontoConfig.config.encryptionKey,
    );
    if (decryptedAccess === "pending") {
      throw new Error("Qonto not authorized — complete OAuth bootstrap first");
    }

    if (doc.accessTokenExpiresAt.getTime() - ACCESS_SKEW_MS > Date.now()) {
      return decryptedAccess;
    }

    return this.refreshAccessTokenSerialized();
  }

  async hasStoredCredentials(): Promise<boolean> {
    if (!this.qontoConfig.isEnabled()) {
      return false;
    }
    await connectMongo();
    const Model = await getQontoOAuthCredentialModel();
    const doc = await Model.findOne({ key: QONTO_OAUTH_SINGLETON_KEY }).lean().exec();
    if (!doc) {
      return false;
    }
    try {
      const access = decryptSecret(doc.accessTokenEnc, this.qontoConfig.config.encryptionKey);
      return access !== "pending";
    } catch {
      return false;
    }
  }

  async getCachedBankAccountId(): Promise<string | undefined> {
    await connectMongo();
    const Model = await getQontoOAuthCredentialModel();
    const doc = await Model.findOne({ key: QONTO_OAUTH_SINGLETON_KEY }).lean().exec();
    return doc?.bankAccountId ?? this.qontoConfig.config.bankAccountId;
  }

  async setCachedBankAccountId(bankAccountId: string): Promise<void> {
    await connectMongo();
    const Model = await getQontoOAuthCredentialModel();
    await Model.updateOne(
      { key: QONTO_OAUTH_SINGLETON_KEY },
      { $set: { bankAccountId } },
      { upsert: false },
    ).exec();
  }

  private refreshAccessTokenSerialized(): Promise<string> {
    if (!this.refreshChain) {
      this.refreshChain = this.refreshAccessToken().finally(() => {
        this.refreshChain = null;
      });
    }
    return this.refreshChain;
  }

  private async refreshAccessToken(): Promise<string> {
    const Model = await getQontoOAuthCredentialModel();
    const doc = await Model.findOne({ key: QONTO_OAUTH_SINGLETON_KEY }).exec();
    if (!doc) {
      throw new Error("Qonto not authorized — complete OAuth bootstrap first");
    }
    const refreshToken = decryptSecret(doc.refreshTokenEnc, this.qontoConfig.config.encryptionKey);
    if (refreshToken === "pending") {
      throw new Error("Qonto not authorized — complete OAuth bootstrap first");
    }

    const tokens = await this.exchangeToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    if (!tokens.refresh_token) {
      throw new Error("Qonto refresh did not return a new refresh_token");
    }
    await this.persistTokens(tokens);
    return tokens.access_token;
  }

  private async persistTokens(tokens: TokenResponse): Promise<void> {
    const key = this.qontoConfig.config.encryptionKey;
    const now = Date.now();
    const accessExpires = new Date(now + tokens.expires_in * 1000);
    const refreshTtlMs =
      typeof tokens.refresh_token_expires_in === "number"
        ? tokens.refresh_token_expires_in * 1000
        : DEFAULT_REFRESH_TTL_MS;
    const refreshExpires = new Date(now + refreshTtlMs);

    await connectMongo();
    const Model = await getQontoOAuthCredentialModel();
    await Model.findOneAndUpdate(
      { key: QONTO_OAUTH_SINGLETON_KEY },
      {
        $set: {
          accessTokenEnc: encryptSecret(tokens.access_token, key),
          refreshTokenEnc: encryptSecret(tokens.refresh_token!, key),
          accessTokenExpiresAt: accessExpires,
          refreshTokenExpiresAt: refreshExpires,
        },
        $setOnInsert: { key: QONTO_OAUTH_SINGLETON_KEY },
      },
      { upsert: true },
    ).exec();
  }

  private async exchangeToken(body: Record<string, string>): Promise<TokenResponse> {
    const { endpoints, clientId, clientSecret, stagingToken, env } = this.qontoConfig.config;
    const params = new URLSearchParams({
      ...body,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };
    if (env === "sandbox" && stagingToken) {
      headers["X-Qonto-Staging-Token"] = stagingToken;
    }

    const response = await fetch(endpoints.tokenUrl, {
      method: "POST",
      headers,
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      this.logger.error(`Qonto token exchange failed status=${response.status}`);
      throw new Error(
        `Qonto token exchange failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }

    return (await response.json()) as TokenResponse;
  }

  private assertConfigured(): void {
    if (!this.qontoConfig.isEnabled()) {
      throw new Error("Qonto integration is not configured (missing env vars)");
    }
  }
}

function timingSafeEqualString(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return ha.equals(hb);
}
