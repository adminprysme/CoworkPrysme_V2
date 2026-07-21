import Stripe from "stripe";

export interface StripeRefundRuntimeConfig {
  secretKey: string;
  webhookSecret: string | null;
  /** Non-secret mode hint for logs: "test" | "live" | "unknown". */
  mode: "test" | "live" | "unknown";
}

/**
 * Load Stripe secrets for gestion-api refunds.
 * STRIPE_SECRET_KEY MUST be the same account+mode as vitrine-api
 * (PaymentIntents were created there).
 */
export function loadStripeRefundConfig(
  env: NodeJS.ProcessEnv = process.env,
): StripeRefundRuntimeConfig | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return null;
  }
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() || null;
  let mode: StripeRefundRuntimeConfig["mode"] = "unknown";
  if (secretKey.startsWith("sk_test_")) mode = "test";
  else if (secretKey.startsWith("sk_live_")) mode = "live";
  return { secretKey, webhookSecret, mode };
}

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });
}
