import type {
  PermissionsCompaniesResponse,
  PermissionsSecteursResponse,
  PermissionsUsersResponse,
} from "./permissions.js";

import { API_URL } from "./api.js";

async function permissionsFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchPermissionsCompanies(): Promise<PermissionsCompaniesResponse> {
  return permissionsFetch<PermissionsCompaniesResponse>("/admin/permissions/companies");
}

export function fetchPermissionsSecteurs(companyId: string): Promise<PermissionsSecteursResponse> {
  const params = new URLSearchParams({ companyId });
  return permissionsFetch<PermissionsSecteursResponse>(`/admin/permissions/secteurs?${params}`);
}

export function fetchPermissionsUsers(filters: {
  companyId?: string;
  secteurId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<PermissionsUsersResponse> {
  const params = new URLSearchParams();
  if (filters.companyId) {
    params.set("companyId", filters.companyId);
  }
  if (filters.secteurId) {
    params.set("secteurId", filters.secteurId);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.page) {
    params.set("page", String(filters.page));
  }
  if (filters.pageSize) {
    params.set("pageSize", String(filters.pageSize));
  }
  const query = params.toString();
  return permissionsFetch<PermissionsUsersResponse>(
    `/admin/permissions/users${query ? `?${query}` : ""}`,
  );
}
