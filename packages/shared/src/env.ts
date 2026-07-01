import { z } from "zod";

import { UploadLimitsSchema } from "./uploads.js";

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

const allowedOriginsSchema = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .superRefine((origins, ctx) => {
    if (origins.length === 0) {
      ctx.addIssue({ code: "custom", message: GENERIC_ENV_ERROR });
    }
    if (origins.includes("*")) {
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

export type ServerEnv = z.infer<ReturnType<typeof createServerEnvSchema>>;

export const createVitrineWebEnvSchema = (env: NodeJS.ProcessEnv) =>
  z.object({
    NEXT_PUBLIC_SITE_URL: siteUrlSchema(env),
    NEXT_PUBLIC_API_URL: z.string().url(),
  });

export type VitrineWebEnv = z.infer<ReturnType<typeof createVitrineWebEnvSchema>>;

const authModeSchema = z.enum(["local", "sso"]);

const cookieSameSiteSchema = z.enum(["lax", "none", "strict"]).default("lax");

export const GestionWebEnvSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_AUTH_MODE: authModeSchema.default("local"),
  VITE_CENTRALE_HOME_URL: z.string().url().optional(),
});

export type GestionWebEnv = z.infer<typeof GestionWebEnvSchema>;

const uploadsDirSchema = (env: NodeJS.ProcessEnv) =>
  z
    .string()
    .min(1)
    .optional()
    .superRefine((value, ctx) => {
      if (isProduction(env) && !value?.trim()) {
        ctx.addIssue({ code: "custom", message: GENERIC_ENV_ERROR, path: [] });
      }
    });

export const VitrineApiEnvSchema = (env: NodeJS.ProcessEnv) =>
  z.object({
    MONGODB_URI: mongoUriSchema(env),
    MONGODB_DB_COWORK: z.string().min(1).default("cowork_bdd"),
    ALLOWED_ORIGIN: allowedOriginsSchema,
    GESTION_API_URL: z.string().url(),
    UPLOADS_DIR: uploadsDirSchema(env),
  });

export type VitrineApiEnv = z.infer<ReturnType<typeof VitrineApiEnvSchema>>;

export const GestionApiEnvSchema = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      MONGODB_URI: mongoUriSchema(env),
      MONGODB_DB_COWORK: z.string().min(1).default("cowork_bdd"),
      MONGODB_DB_PRYSMA: z.string().min(1).default("prysma_bdd"),
      ALLOWED_ORIGIN: allowedOriginsSchema,
      AUTH_MODE: authModeSchema.default("local"),
      SESSION_SECRET: z.string().min(32),
      SESSION_TTL_HOURS: z.coerce.number().int().positive().default(4),
      COOKIE_SECURE: z
        .enum(["true", "false"])
        .default(isProduction(env) ? "true" : "false")
        .transform((value) => value === "true"),
      COOKIE_SAME_SITE: cookieSameSiteSchema,
      CENTRALE_API_URL: z.string().url().optional(),
      CENTRALE_HOME_URL: z.string().url().optional(),
      UPLOADS_DIR: uploadsDirSchema(env),
    })
    .merge(UploadLimitsSchema)
    .superRefine((data, ctx) => {
      if (isProduction(env) && data.AUTH_MODE === "local") {
        ctx.addIssue({ code: "custom", message: GENERIC_ENV_ERROR, path: ["AUTH_MODE"] });
      }
      if (data.AUTH_MODE === "sso") {
        if (!data.CENTRALE_API_URL) {
          ctx.addIssue({ code: "custom", message: GENERIC_ENV_ERROR, path: ["CENTRALE_API_URL"] });
        }
      }
    });

export type GestionApiEnv = z.infer<ReturnType<typeof GestionApiEnvSchema>>;

let cachedServerEnv: ServerEnv | null = null;
let cachedVitrineWebEnv: VitrineWebEnv | null = null;
let cachedGestionWebEnv: GestionWebEnv | null = null;
let cachedVitrineApiEnv: VitrineApiEnv | null = null;
let cachedGestionApiEnv: GestionApiEnv | null = null;

export function parseServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
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

  cachedServerEnv = result.data;
  return cachedServerEnv;
}

export function parseVitrineWebEnv(env: NodeJS.ProcessEnv = process.env): VitrineWebEnv {
  if (cachedVitrineWebEnv) {
    return cachedVitrineWebEnv;
  }

  const result = createVitrineWebEnvSchema(env).safeParse({
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL,
  });

  if (!result.success) {
    throw new Error(GENERIC_ENV_ERROR);
  }

  cachedVitrineWebEnv = result.data;
  return cachedVitrineWebEnv;
}

export function parseGestionWebEnv(env: NodeJS.ProcessEnv = process.env): GestionWebEnv {
  if (cachedGestionWebEnv) {
    return cachedGestionWebEnv;
  }

  const result = GestionWebEnvSchema.safeParse({
    VITE_API_URL: env.VITE_API_URL,
    VITE_AUTH_MODE: env.VITE_AUTH_MODE,
    VITE_CENTRALE_HOME_URL: env.VITE_CENTRALE_HOME_URL,
  });

  if (!result.success) {
    throw new Error(GENERIC_ENV_ERROR);
  }

  cachedGestionWebEnv = result.data;
  return cachedGestionWebEnv;
}

export function parseVitrineApiEnv(env: NodeJS.ProcessEnv = process.env): VitrineApiEnv {
  if (cachedVitrineApiEnv) {
    return cachedVitrineApiEnv;
  }

  const result = VitrineApiEnvSchema(env).safeParse({
    MONGODB_URI: env.MONGODB_URI,
    MONGODB_DB_COWORK: env.MONGODB_DB_COWORK,
    ALLOWED_ORIGIN: env.ALLOWED_ORIGIN,
    GESTION_API_URL: env.GESTION_API_URL,
    UPLOADS_DIR: env.UPLOADS_DIR,
  });

  if (!result.success) {
    throw new Error(GENERIC_ENV_ERROR);
  }

  cachedVitrineApiEnv = result.data;
  return cachedVitrineApiEnv;
}

export function parseGestionApiEnv(env: NodeJS.ProcessEnv = process.env): GestionApiEnv {
  if (cachedGestionApiEnv) {
    return cachedGestionApiEnv;
  }

  const result = GestionApiEnvSchema(env).safeParse({
    MONGODB_URI: env.MONGODB_URI,
    MONGODB_DB_COWORK: env.MONGODB_DB_COWORK,
    MONGODB_DB_PRYSMA: env.MONGODB_DB_PRYSMA,
    ALLOWED_ORIGIN: env.ALLOWED_ORIGIN,
    AUTH_MODE: env.AUTH_MODE,
    SESSION_SECRET: env.SESSION_SECRET,
    SESSION_TTL_HOURS: env.SESSION_TTL_HOURS,
    COOKIE_SECURE: env.COOKIE_SECURE,
    COOKIE_SAME_SITE: env.COOKIE_SAME_SITE,
    CENTRALE_API_URL: env.CENTRALE_API_URL,
    CENTRALE_HOME_URL: env.CENTRALE_HOME_URL,
    UPLOADS_DIR: env.UPLOADS_DIR,
    UPLOAD_MAX_BYTES: env.UPLOAD_MAX_BYTES,
    UPLOAD_MAX_PHOTOS_PER_BUILDING: env.UPLOAD_MAX_PHOTOS_PER_BUILDING,
    UPLOAD_MAX_PHOTOS_PER_SPACE: env.UPLOAD_MAX_PHOTOS_PER_SPACE,
    UPLOAD_MAX_DIMENSION_PX: env.UPLOAD_MAX_DIMENSION_PX,
  });

  if (!result.success) {
    throw new Error(GENERIC_ENV_ERROR);
  }

  cachedGestionApiEnv = result.data;
  return cachedGestionApiEnv;
}

/** Resets cached env — for tests only. */
export function resetServerEnvCache(): void {
  cachedServerEnv = null;
  cachedVitrineWebEnv = null;
  cachedGestionWebEnv = null;
  cachedVitrineApiEnv = null;
  cachedGestionApiEnv = null;
}

export { GENERIC_ENV_ERROR };
