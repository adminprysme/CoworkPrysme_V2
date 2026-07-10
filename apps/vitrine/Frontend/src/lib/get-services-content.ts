import {
  DEFAULT_SERVICES_PUBLIC_CONTENT,
  ServicesPublicContentSchema,
  type ServicesPublicContent,
} from "@coworkprysme/shared";

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8002";
}

export async function getServicesContent(): Promise<ServicesPublicContent> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/services-content`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return DEFAULT_SERVICES_PUBLIC_CONTENT;
    }

    const json: unknown = await response.json();
    return ServicesPublicContentSchema.parse(json);
  } catch {
    return DEFAULT_SERVICES_PUBLIC_CONTENT;
  }
}
