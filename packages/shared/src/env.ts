import { z } from "zod";

const GENERIC_ENV_ERROR = "Invalid or missing environment configuration";

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production";
}

function requiresSecureMongoUri(uri: string): boolean {
  if (uri.startsWith("mongodb+srv://")) {
    return true;
  }

  try {
    const url = new URL(uri.replace(/^mongodb:\/\//, "http://"));
    return url.searchParams.get("tls") === "true";
  } catch {
    return false;
  }
}

const mongoUriSchema = (env: NodeJS.ProcessEnv) =>
  z
    .string()
    .min(1)
    .superRefine((uri, ctx) => {
      if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
        ctx.addIssue({ code: "custom", message: GENERIC_ENV_ERROR });
        return;
      }

      if (isProduction(env) && !requiresSecureMongoUri(uri)) {
        ctx.addIssue({ code: "custom", message: GENERIC_ENV_ERROR });
      }
    });

const siteUrlSchema = (env: NodeJS.ProcessEnv) =>
  z
    .string()
    .url()
    .optional()
    .superRefine((value, ctx) => {
      if (isProduction(env) && !value) {
        ctx.addIssue({ code: "custom", message: GENERIC_ENV_ERROR });
      }
    });

export function createServerEnvSchema(env: NodeJS.ProcessEnv) {
  return z.object({
    MONGODB_URI: mongoUriSchema(env),
    MONGODB_DB_COWORK: z.string().min(1).default("cowork_bdd"),
    MONGODB_DB_PRYSMA: z.string().min(1).default("prysma_bdd"),
    NEXT_PUBLIC_SITE_URL: siteUrlSchema(env),
  });
}

export const ServerEnvSchema = createServerEnvSchema(process.env);

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cachedEnv: ServerEnv | null = null;

/**
 * Validates server environment variables. Must run at module load on the server.
 * Never includes secret values in thrown errors.
 */
export function parseServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = createServerEnvSchema(env).safeParse({
    MONGODB_URI: env.MONGODB_URI,
    MONGODB_DB_COWORK: env.MONGODB_DB_COWORK,
    MONGODB_DB_PRYSMA: env.MONGODB_DB_PRYSMA,
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
  });

  if (!result.success) {
    throw new Error(GENERIC_ENV_ERROR);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/** Resets cached env — for tests only. */
export function resetServerEnvCache(): void {
  cachedEnv = null;
}

export { GENERIC_ENV_ERROR };
