"use client";

import { useEffect, useState } from "react";

export function useBookingLockCountdown(expiresAt: string | null) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setRemainingMs(null);
      return;
    }

    const tick = () => {
      const next = new Date(expiresAt).getTime() - Date.now();
      setRemainingMs(Math.max(0, next));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  return remainingMs;
}

export function formatCountdown(remainingMs: number | null): string {
  if (remainingMs === null) {
    return "—";
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
