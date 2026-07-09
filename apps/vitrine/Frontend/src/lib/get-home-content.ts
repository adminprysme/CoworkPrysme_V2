import {
  DEFAULT_HOME_PUBLIC_CONTENT,
  HomePublicContentSchema,
  type HomePublicContent,
} from "@coworkprysme/shared";

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8002";
}

export async function getHomeContent(): Promise<HomePublicContent> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/home-content`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return DEFAULT_HOME_PUBLIC_CONTENT;
    }

    const json: unknown = await response.json();
    return HomePublicContentSchema.parse(json);
  } catch {
    return DEFAULT_HOME_PUBLIC_CONTENT;
  }
}
