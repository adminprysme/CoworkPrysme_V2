export interface PrysmaCompanyOption {
  id: string;
  name: string;
}

export interface PrysmaSecteurOption {
  id: string;
  name: string;
  companyId: string;
}

export interface PermissionsUserRow {
  id: string;
  photo?: string;
  displayName: string;
  companyId?: string;
  companyName?: string;
  position?: string;
  role: "admin" | "manager" | "none";
}

export type PermissionsPageSize = 25 | 50 | 100;

export interface PermissionsPagination {
  page: number;
  pageSize: PermissionsPageSize;
  total: number;
  totalPages: number;
}

export interface PermissionsUsersResponse {
  users: PermissionsUserRow[];
  pagination: PermissionsPagination;
}

export const PERMISSIONS_PAGE_SIZES: PermissionsPageSize[] = [25, 50, 100];

export interface PermissionsCompaniesResponse {
  companies: PrysmaCompanyOption[];
}

export interface PermissionsSecteursResponse {
  secteurs: PrysmaSecteurOption[];
}

export {
  fetchPermissionsCompanies,
  fetchPermissionsSecteurs,
  fetchPermissionsUsers,
} from "./permissions-api.js";
