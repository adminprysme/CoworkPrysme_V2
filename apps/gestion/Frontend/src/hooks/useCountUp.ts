import { useEffect, useState } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export interface UseCountUpOptions {
  /** Animation length in ms. Default 900. */
  durationMs?: number;
  /** When false, jump straight to the target. Default true. */
  enabled?: boolean;
}

/**
 * Animates a numeric value from 0 → `target` whenever `target` / `enabled` change.
 * Honours `prefers-reduced-motion: reduce` (instant jump to target).
 */
export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { durationMs = 900, enabled = true } = options;
  const [value, setValue] = useState(() => (enabled ? 0 : target));

  useEffect(() => {
    if (!enabled || prefersReducedMotion() || durationMs <= 0) {
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    setValue(0);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const next = target * easeOutCubic(progress);
      setValue(progress >= 1 ? target : next);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, enabled]);

  return value;
}
