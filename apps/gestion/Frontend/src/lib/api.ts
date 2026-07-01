export const API_URL = import.meta.env.VITE_API_URL as string;
export const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE ?? "local") as "local" | "sso";
export const CENTRALE_HOME_URL = import.meta.env.VITE_CENTRALE_HOME_URL as string | undefined;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export interface AuthMeResponse {
  profile: {
    id: string;
    prysmAppUserId: string;
    displayName: string;
    email: string;
    role: "manager" | "admin";
    permissions: Record<string, boolean>;
    scope: { buildingIds: string[]; spaceTypes: string[] };
    status: "active" | "revoked";
  };
  authSource: "local" | "sso";
  enrichment?: {
    photo?: string;
    position?: string;
    service?: string;
    office?: string;
  };
}

export function fetchMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>("/auth/me");
}

export function loginLocal(username: string, password: string): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function loginSso(ssoToken: string): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>("/auth/sso", {
    method: "POST",
    body: JSON.stringify({ sso_token: ssoToken }),
  });
}

export function logout(): Promise<{ redirectUrl: string }> {
  return apiFetch<{ redirectUrl: string }>("/auth/logout", { method: "POST" });
}
