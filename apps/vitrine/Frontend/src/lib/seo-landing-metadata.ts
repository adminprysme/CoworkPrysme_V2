import type { Metadata } from "next";

import { SITE, SITE_URL } from "@/config/site";
import type { SeoLandingPageConfig } from "@/config/seo-landing-pages";

/** Metadata with exact title/description (no template suffix). */
export function createSeoLandingMetadata(page: SeoLandingPageConfig): Metadata {
  const canonical = `${SITE_URL}${page.path}`;

  return {
    title: page.title,
    description: page.description,
    keywords: [...SITE.keywords] as string[],
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      locale: SITE.locale,
      url: canonical,
      siteName: SITE.name,
      title: page.title,
      description: page.description,
      images: [{ url: page.ogImage, width: 1200, height: 630, alt: page.h1 }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [page.ogImage],
    },
    robots: { index: true, follow: true },
  };
}
