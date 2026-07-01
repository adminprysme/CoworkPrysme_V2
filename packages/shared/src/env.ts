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

export const ServerEnvSchema = createServerEnvSchema(process.env);

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export const createVitrineWebEnvSchema = (env: NodeJS.ProcessEnv) =>
  z.object({
    NEXT_PUBLIC_SITE_URL: siteUrlSchema(env),
    NEXT_PUBLIC_API_URL: z.string().url(),
  });

export const VitrineWebEnvSchema = createVitrineWebEnvSchema(process.env);

export type VitrineWebEnv = z.infer<ReturnType<typeof createVitrineWebEnvSchema>>;

export const GestionWebEnvSchema = z.object({
  VITE_API_URL: z.string().url(),
});

export type GestionWebEnv = z.infer<typeof GestionWebEnvSchema>;

export const VitrineApiEnvSchema = (env: NodeJS.ProcessEnv) =>
  z.object({
    MONGODB_URI: mongoUriSchema(env),
    MONGODB_DB_COWORK: z.string().min(1).default("cowork_bdd"),
    ALLOWED_ORIGIN: allowedOriginsSchema,
    GESTION_API_URL: z.string().url(),
  });

export type VitrineApiEnv = z.infer<ReturnType<typeof VitrineApiEnvSchema>>;

export const GestionApiEnvSchema = (env: NodeJS.ProcessEnv) =>
  z.object({
    MONGODB_URI: mongoUriSchema(env),
    MONGODB_DB_COWORK: z.string().min(1).default("cowork_bdd"),
    MONGODB_DB_PRYSMA: z.string().min(1).default("prysma_bdd"),
    ALLOWED_ORIGIN: allowedOriginsSchema,
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
