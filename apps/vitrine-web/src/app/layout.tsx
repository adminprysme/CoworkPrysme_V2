import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Cowork Prysme",
    template: "%s | Cowork Prysme",
  },
  description: "Espace de coworking Prysme — vitrine publique",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"),
  openGraph: {
    type: "website",
    locale: "fr_FR",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
