import type { AuthMeResponse } from "../lib/api.js";

export type PermissionKey = keyof AuthMeResponse["profile"]["permissions"];

export interface NavItem {
  id: string;
  label: string;
  path: string;
  /** Always visible once authenticated. */
  always?: boolean;
  /** Visible to any staff member (authenticated). */
  staff?: boolean;
  /** Requires a specific permission flag from /me. */
  permission?: PermissionKey;
  /** Requires admin role. */
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Tableau de bord", path: "/dashboard", always: true },
  { id: "planning", label: "Planning", path: "/planning", permission: "planning" },
  { id: "reservations", label: "Réservations", path: "/reservations", permission: "planning" },
  { id: "spaces", label: "Bâtiments & Espaces", path: "/spaces", permission: "spaces" },
  { id: "clients", label: "Clients (Cardex)", path: "/clients", permission: "clients" },
  { id: "billing", label: "Facturation", path: "/billing", permission: "billing" },
  { id: "promo", label: "Codes promo", path: "/promo", permission: "promo" },
  { id: "stats", label: "Statistiques", path: "/stats", permission: "stats" },
  { id: "news", label: "Actualités & Offres", path: "/news", staff: true },
  { id: "incidents", label: "Pannes / Incidents", path: "/incidents", staff: true },
  {
    id: "administration",
    label: "Administration",
    path: "/administration",
    adminOnly: true,
  },
];

export function isNavItemVisible(item: NavItem, user: AuthMeResponse): boolean {
  if (item.always) {
    return true;
  }
  if (item.adminOnly) {
    return user.profile.role === "admin";
  }
  if (item.staff) {
    return true;
  }
  if (item.permission) {
    return user.profile.permissions[item.permission] === true;
  }
  return false;
}

export function getNavItemByPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.path === pathname);
}
