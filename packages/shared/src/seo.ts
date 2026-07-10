export const SEO_META_DESCRIPTION_MAX_LENGTH = 160;

export interface SpaceSeoMeta {
  slug: string;
  metaTitle: string;
  metaDescription: string;
}

/** Converts a display name to a URL-safe kebab-case slug. */
export function slugifySpaceName(name: string): string {
  return slugifyEntityName(name, "espace");
}

/** Converts a building name to a URL-safe kebab-case slug. */
export function slugifyBuildingName(name: string): string {
  return slugifyEntityName(name, "batiment");
}

/** Converts a service label to a stable catalog key (kebab-case). */
export function slugifyServiceKey(label: string): string {
  return slugifyEntityName(label, "service");
}

function slugifyEntityName(name: string, fallback: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

/** Builds default SEO metadata from space name and optional description. */
export function buildSpaceSeoMeta(name: string, description?: string): SpaceSeoMeta {
  const trimmedName = name.trim();
  const trimmedDescription = description?.trim();
  const slug = slugifySpaceName(trimmedName);

  const metaTitle = `${trimmedName} | Cowork Prysme`;
  const metaDescription =
    trimmedDescription && trimmedDescription.length > 0
      ? trimmedDescription.slice(0, SEO_META_DESCRIPTION_MAX_LENGTH)
      : `${trimmedName} — espace coworking Cowork Prysme.`.slice(
          0,
          SEO_META_DESCRIPTION_MAX_LENGTH,
        );

  return { slug, metaTitle, metaDescription };
}

/** Builds default SEO metadata from building name and optional description. */
export function buildBuildingSeoMeta(name: string, description?: string): SpaceSeoMeta {
  const trimmedName = name.trim();
  const trimmedDescription = description?.trim();
  const slug = slugifyBuildingName(trimmedName);

  const metaTitle = `${trimmedName} | Cowork Prysme`;
  const metaDescription =
    trimmedDescription && trimmedDescription.length > 0
      ? trimmedDescription.slice(0, SEO_META_DESCRIPTION_MAX_LENGTH)
      : `${trimmedName} — coworking Cowork Prysme à Lyon.`.slice(
          0,
          SEO_META_DESCRIPTION_MAX_LENGTH,
        );

  return { slug, metaTitle, metaDescription };
}

/**
 * Returns slug candidates for uniqueness resolution: base, base-2, base-3…
 * Used by the API to pick the first slug not already taken.
 */
export function* iterateSlugCandidates(baseSlug: string): Generator<string> {
  yield baseSlug;
  let suffix = 2;
  while (true) {
    yield `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

/** Picks the first slug candidate not present in `takenSlugs`. */
export function resolveUniqueSlugFromSet(baseSlug: string, takenSlugs: Set<string>): string {
  for (const candidate of iterateSlugCandidates(baseSlug)) {
    if (!takenSlugs.has(candidate)) {
      return candidate;
    }
  }

  return baseSlug;
}
