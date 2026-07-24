import type { Request } from "express";

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-f:]+$/i;

/**
 * Best-effort client IP from Express `req.ip` (requires trust proxy = 1 behind Coolify).
 * Returns undefined when missing/invalid — callers must still accept the quote.
 */
export function clientIpFromRequest(req: Request): string | undefined {
  try {
    const raw = typeof req.ip === "string" ? req.ip.trim() : "";
    if (!raw) return undefined;
    const normalized = raw.startsWith("::ffff:") ? raw.slice("::ffff:".length) : raw;
    if (!normalized || normalized.length > 45) return undefined;
    if (IPV4_RE.test(normalized) || IPV6_RE.test(normalized)) {
      return normalized;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
