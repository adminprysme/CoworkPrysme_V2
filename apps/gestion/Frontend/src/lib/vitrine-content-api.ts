import type {
  UpdateVitrineContentRequest,
  VitrineContentResponse,
  VitrineImageSlot,
} from "@coworkprysme/shared";
import { mediaPathFromVitrineStorageKey } from "@coworkprysme/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "";

async function vitrineContentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (typeof body.message === "string") {
        message = body.message;
      } else if (Array.isArray(body.message)) {
        message = body.message.join(", ");
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getVitrineImagePreviewUrl(storageKey: string): string {
  return `${API_URL}${mediaPathFromVitrineStorageKey(storageKey)}`;
}

export function getVitrineImageFilename(storageKey: string): string {
  return storageKey.split("/").pop() ?? storageKey;
}

export function fetchVitrineContent() {
  return vitrineContentFetch<VitrineContentResponse>("/admin/vitrine-content");
}

export function updateVitrineContent(body: UpdateVitrineContentRequest) {
  return vitrineContentFetch<VitrineContentResponse>("/admin/vitrine-content", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function uploadVitrineImage(slot: VitrineImageSlot, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return vitrineContentFetch<VitrineContentResponse>(`/admin/vitrine-content/images/${slot}`, {
    method: "POST",
    body: formData,
  });
}

export function deleteVitrineImage(slot: VitrineImageSlot, storageKey: string) {
  const filename = getVitrineImageFilename(storageKey);
  return vitrineContentFetch<VitrineContentResponse>(
    `/admin/vitrine-content/images/${slot}/${filename}`,
    { method: "DELETE" },
  );
}

export type { VitrineContentResponse, VitrineImageSlot };
