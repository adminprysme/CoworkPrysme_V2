import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SITE, SITE_URL } from "@/config/site";
import { getDefaultCatalogBuildingSlug } from "@/lib/get-catalog-content";
import { getSiteContact } from "@/lib/get-building-info";

import "./globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const bodyFont = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE.name,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.defaultDescription,
  keywords: [...SITE.keywords],
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    siteName: SITE.name,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [contact, defaultBuildingSlug] = await Promise.all([
    getSiteContact(),
    getDefaultCatalogBuildingSlug(),
  ]);

  return (
    <html lang="fr" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <div className="siteShell">
          <SiteHeader defaultBuildingSlug={defaultBuildingSlug} />
          <main className="siteMain">{children}</main>
          <SiteFooter contact={contact} defaultBuildingSlug={defaultBuildingSlug} />
        </div>
      </body>
    </html>
  );
}
