import Stripe from "stripe";

export interface StripeRuntimeConfig {
  secretKey: string;
  webhookSecret: string;
}

export function loadStripeConfig(env: NodeJS.ProcessEnv = process.env): StripeRuntimeConfig | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey || !webhookSecret) {
    return null;
  }
  return { secretKey, webhookSecret };
}

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });
}
