const SESSION_STORAGE_KEY = "vitrine-booking-session-id";

export function getBookingSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const sessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}
