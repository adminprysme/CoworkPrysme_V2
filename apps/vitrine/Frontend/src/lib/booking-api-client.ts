function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8002";
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

export async function bookingFetch<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof json === "object" &&
      json !== null &&
      "message" in json &&
      typeof json.message === "string"
        ? json.message
        : "Booking request failed";
    throw new Error(message);
  }

  return schema.parse(json);
}

export { getApiBaseUrl };
