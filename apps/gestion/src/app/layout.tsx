import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Cowork Gestion",
    template: "%s | Cowork Gestion",
  },
  description: "Interface interne de gestion Cowork Prysme",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
