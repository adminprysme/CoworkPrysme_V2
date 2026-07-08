import type { Metadata } from "next";

import { SITE, SITE_URL } from "@/config/site";

export interface PageMetadataInput {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
  ogImage?: string;
}

export function createPageMetadata({
  title,
  description,
  path = "",
  noIndex = false,
  ogImage = SITE.social.ogImage,
}: PageMetadataInput): Metadata {
  const canonical = `${SITE_URL}${path}`;
  const fullTitle = path === "/" || title.includes(SITE.name) ? title : `${title} | ${SITE.name}`;

  return {
    title: path === "/" ? fullTitle : title,
    description,
    keywords: [...SITE.keywords] as string[],
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      locale: SITE.locale,
      url: canonical,
      siteName: SITE.name,
      title: fullTitle,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export const homeMetadata = createPageMetadata({
  title: "Coworking Lyon 7 — Bureaux & salles de réunion | Cowork Prysme",
  description:
    "Coworking premium à Lyon 7, Gerland / Jean Macé : bureaux privatifs, salles de réunion et espaces flexibles. Le lieu qui donne de l'élan à vos événements.",
  path: "/",
});
