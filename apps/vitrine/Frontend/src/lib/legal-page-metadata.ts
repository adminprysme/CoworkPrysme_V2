import type { Metadata } from "next";

import type { LegalPageMeta } from "@/config/legal/meta";
import { SITE, SITE_URL } from "@/config/site";

export function createLegalPageMetadata(page: LegalPageMeta): Metadata {
  const canonical = `${SITE_URL}${page.path}`;

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: SITE.locale,
      url: canonical,
      siteName: SITE.name,
      title: page.title,
      description: page.description,
    },
    robots: { index: false, follow: true },
  };
}
