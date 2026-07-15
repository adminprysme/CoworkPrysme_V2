const SESSION_STORAGE_KEY = "vitrine-booking-session-id";
const SESSION_COOKIE_KEY = "vitrine-booking-session-id";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeSessionCookie(value: string): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_COOKIE_KEY}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

export function getBookingSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const fromStorage = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (fromStorage) {
    writeSessionCookie(fromStorage);
    return fromStorage;
  }

  const fromCookie = readCookie(SESSION_COOKIE_KEY);
  if (fromCookie) {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, fromCookie);
    return fromCookie;
  }

  const sessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  writeSessionCookie(sessionId);
  return sessionId;
}
