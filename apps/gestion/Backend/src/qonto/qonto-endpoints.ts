export type QontoEnvironment = "sandbox" | "production";

export interface QontoEndpoints {
  authorizeUrl: string;
  tokenUrl: string;
  apiBaseUrl: string;
}

export function resolveQontoEndpoints(env: QontoEnvironment): QontoEndpoints {
  if (env === "production") {
    return {
      authorizeUrl: "https://oauth.qonto.com/oauth2/auth",
      tokenUrl: "https://oauth.qonto.com/oauth2/token",
      apiBaseUrl: "https://thirdparty.qonto.com",
    };
  }
  return {
    authorizeUrl: "https://oauth-sandbox.staging.qonto.co/oauth2/auth",
    tokenUrl: "https://oauth-sandbox.staging.qonto.co/oauth2/token",
    apiBaseUrl: "https://thirdparty-sandbox.staging.qonto.co",
  };
}

export const QONTO_OAUTH_SCOPES = "offline_access organization.read" as const;
