export const LEGAL_LAST_UPDATED = new Date("2026-07-09T12:00:00+02:00");

export function formatLegalLastUpdated(date: Date = LEGAL_LAST_UPDATED): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export interface LegalPageMeta {
  path: string;
  title: string;
  description: string;
  h1: string;
}

export const LEGAL_PAGES: LegalPageMeta[] = [
  {
    path: "/mentions-legales",
    title: "Mentions légales — Cowork Prysme",
    description: "Mentions légales du site CoWork Prysme édité par CG Développement.",
    h1: "Mentions Légales",
  },
  {
    path: "/politique-de-confidentialite",
    title: "Politique de confidentialité — Cowork Prysme",
    description:
      "Politique de confidentialité et protection des données personnelles — CoWork Prysme / CG Développement.",
    h1: "Politique de Confidentialité",
  },
  {
    path: "/cgv",
    title: "Conditions Générales de Vente — Cowork Prysme",
    description:
      "Conditions Générales de Vente des services de location d'espaces de coworking CoWork Prysme.",
    h1: "Conditions Générales de Vente",
  },
];

export const LEGAL_CROSS_LINKS = LEGAL_PAGES.map((page) => ({
  href: page.path,
  label: page.h1,
}));

/** Placeholder for future booking tunnel — CGV acceptance step. */
export const BOOKING_CGV_ACCEPTANCE_HOOK =
  "BOOKING_TUNNEL: render CGV acceptance checkbox before payment confirmation";

export function getLegalPageMeta(path: string): LegalPageMeta | undefined {
  return LEGAL_PAGES.find((page) => page.path === path);
}
