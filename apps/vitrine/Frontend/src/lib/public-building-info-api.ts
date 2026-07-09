function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8002";
}

export function getPublicBuildingInfoUrl(): string {
  return `${getApiBaseUrl()}/site-contact`;
}
