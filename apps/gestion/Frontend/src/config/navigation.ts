import type { AuthMeResponse } from "../lib/api.js";

export type PermissionKey = keyof AuthMeResponse["profile"]["permissions"];

export interface NavItem {
  id: string;
  label: string;
  path: string;
  /** Match the path exactly (not as a prefix). Auto-set when another nav item is nested under this path. */
  end?: boolean;
  /** Always visible once authenticated. */
  always?: boolean;
  /** Visible to any staff member (authenticated). */
  staff?: boolean;
  /** Requires a specific permission flag from /me. */
  permission?: PermissionKey;
  /** Requires admin role. */
  adminOnly?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/** Shown first, outside of any group. */
export const NAV_STANDALONE_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Tableau de bord", path: "/dashboard", always: true },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "operations",
    label: "Exploitation",
    items: [
      { id: "planning", label: "Planning", path: "/planning", permission: "planning" },
      { id: "reservations", label: "Réservations", path: "/reservations", permission: "planning" },
      { id: "spaces", label: "Bâtiments & Espaces", path: "/spaces", permission: "spaces" },
    ],
  },
  {
    id: "commercial",
    label: "Clients & revenus",
    items: [
      { id: "clients", label: "Clients", path: "/clients", permission: "clients" },
      { id: "billing", label: "Facturation", path: "/billing", permission: "billing", end: true },
      { id: "services", label: "Services", path: "/services", permission: "services" },
      { id: "promo", label: "Codes promo", path: "/promo", permission: "promo" },
    ],
  },
  {
    id: "pilotage",
    label: "Pilotage",
    items: [{ id: "stats", label: "Statistiques", path: "/stats", permission: "stats" }],
  },
  {
    id: "site",
    label: "Vie du site",
    items: [
      { id: "news", label: "Actualités & Offres", path: "/news", staff: true },
      { id: "incidents", label: "Incidents", path: "/incidents", staff: true },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    items: [
      {
        id: "administration",
        label: "Permissions",
        path: "/administration",
        adminOnly: true,
      },
      {
        id: "vitrine-edition",
        label: "Edition Vitrine",
        path: "/administration/vitrine",
        adminOnly: true,
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = [
  ...NAV_STANDALONE_ITEMS,
  ...NAV_GROUPS.flatMap((group) => group.items),
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

export function getVisibleStandaloneNavItems(user: AuthMeResponse): NavItem[] {
  return NAV_STANDALONE_ITEMS.filter((item) => isNavItemVisible(item, user));
}

export function getVisibleNavGroups(user: AuthMeResponse): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isNavItemVisible(item, user)),
  })).filter((group) => group.items.length > 0);
}

export function getNavItemByPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.path === pathname);
}

export function getNavItemEnd(item: NavItem): boolean {
  if (item.end !== undefined) {
    return item.end;
  }

  return NAV_ITEMS.some(
    (other) => other.path !== item.path && other.path.startsWith(`${item.path}/`),
  );
}
