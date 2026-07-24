export const CATALOG_BASE_PATHS = {
  privateOffices: "/bureaux-privatifs",
  meetingRooms: "/salle-de-reunion",
  tariffs: "/tarifs",
} as const;

const CATALOG_PATH_SET = new Set<string>(Object.values(CATALOG_BASE_PATHS));

export function isCatalogBasePath(href: string): boolean {
  return CATALOG_PATH_SET.has(href);
}

export function catalogHref(basePath: string, buildingSlug: string | null | undefined): string {
  if (!buildingSlug || !isCatalogBasePath(basePath)) {
    return basePath;
  }
  return `${basePath}/${buildingSlug}`;
}

export function resolveNavHref(
  href: string,
  defaultBuildingSlug: string | null | undefined,
): string {
  if (isCatalogBasePath(href)) {
    return catalogHref(href, defaultBuildingSlug);
  }
  return href;
}

export function resolveRelatedLinkHref(
  href: string,
  buildingSlug: string | null | undefined,
): string {
  return resolveNavHref(href, buildingSlug);
}

export function navItemBasePath(href: string): string {
  if (isCatalogBasePath(href)) {
    return href;
  }
  for (const basePath of CATALOG_PATH_SET) {
    if (href.startsWith(`${basePath}/`)) {
      return basePath;
    }
  }
  return href;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  const basePath = navItemBasePath(href);
  if (isCatalogBasePath(basePath)) {
    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
