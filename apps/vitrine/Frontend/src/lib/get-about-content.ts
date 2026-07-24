import {
  AboutPublicContentSchema,
  DEFAULT_ABOUT_PUBLIC_CONTENT,
  type AboutPublicContent,
} from "@coworkprysme/shared";

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8002";
}

export async function getAboutContent(): Promise<AboutPublicContent> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/about-content`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return DEFAULT_ABOUT_PUBLIC_CONTENT;
    }

    const json: unknown = await response.json();
    return AboutPublicContentSchema.parse(json);
  } catch {
    return DEFAULT_ABOUT_PUBLIC_CONTENT;
  }
}
