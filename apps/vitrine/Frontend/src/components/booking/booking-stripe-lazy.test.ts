import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("booking Stripe lazy load", () => {
  it("does not statically import Stripe from the confirmed step (dynamic only)", () => {
    const confirmed = readFileSync(join(here, "BookingConfirmedStep.tsx"), "utf8");
    expect(confirmed).toMatch(/dynamic\(/);
    expect(confirmed).toMatch(/import\("\.\/BookingCardPaymentForm"\)/);
    expect(confirmed).not.toMatch(
      /import\s+\{\s*BookingCardPaymentForm\s*\}\s+from\s+"\.\/BookingCardPaymentForm"/,
    );
    expect(confirmed).not.toMatch(/@stripe\/react-stripe-js/);
    expect(confirmed).not.toMatch(/@stripe\/stripe-js/);
  });

  it("keeps Stripe SDK imports inside BookingCardPaymentForm only", () => {
    const form = readFileSync(join(here, "BookingCardPaymentForm.tsx"), "utf8");
    expect(form).toMatch(/@stripe\/react-stripe-js/);
    expect(form).toMatch(/@stripe\/stripe-js/);
  });
});
