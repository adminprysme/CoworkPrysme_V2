export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://coworkprysme.eu";

/** Base URL of the internal gestion-web app (client login). */
export const GESTION_WEB_URL =
  process.env.NEXT_PUBLIC_GESTION_WEB_URL?.replace(/\/$/, "") ?? "http://localhost:3002";

export const CLIENT_PORTAL_URL = `${GESTION_WEB_URL}/login`;

export const SITE = {
  name: "Cowork Prysme",
  legalName: "CoWork Prysme",
  tagline: "Coworking premium à Lyon 7 — Gerland / Jean Macé",
  locale: "fr_FR",
  defaultDescription:
    "Coworking premium à Lyon 7 : bureaux privatifs, salles de réunion et espaces flexibles au cœur de Gerland / Jean Macé. Réservez en ligne.",
  keywords: [
    "coworking Lyon 7",
    "coworking Gerland",
    "coworking Jean Macé",
    "bureau Lyon 7",
    "salle de réunion Lyon",
    "bureau sans engagement Lyon",
    "coworking freelance Lyon",
  ],
  contact: {
    email: "contact@prysme.eu",
    phone: "04 78 86 92 55",
    phoneHref: "tel:+33478869255",
    addressLine1: "Lyon 7ème — quartier Gerland / Jean Macé",
    addressLine2: "69007 Lyon, France",
  },
  social: {
    ogImage:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&h=630&q=80",
  },
} as const;

export const MAIN_NAV = [
  { href: "/", label: "Accueil" },
  { href: "/bureaux-privatifs", label: "Bureaux privatifs" },
  { href: "/salle-de-reunion", label: "Salles de réunion" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact & accès" },
] as const;

export const FOOTER_NAV = {
  discover: [
    { href: "/bureaux-privatifs", label: "Bureaux privatifs" },
    { href: "/salle-de-reunion", label: "Salles de réunion" },
    { href: "/tarifs", label: "Tarifs" },
    { href: "/services", label: "Services" },
  ],
  company: [
    { href: "/a-propos", label: "À propos" },
    { href: "/avis", label: "Avis clients" },
    { href: "/faq", label: "FAQ" },
  ],
  legal: [
    { href: "/mentions-legales", label: "Mentions légales" },
    { href: "/politique-de-confidentialite", label: "Politique de confidentialité" },
  ],
} as const;

export interface PageSeoConfig {
  path: string;
  title: string;
  description: string;
  h1?: string;
  noIndex?: boolean;
}

export const STUB_PAGES: PageSeoConfig[] = [
  {
    path: "/bureaux-privatifs",
    title: "Bureaux privatifs Lyon 7",
    description:
      "Louez un bureau privatif à Lyon 7, Gerland / Jean Macé. Espaces calmes, flexibles et premium chez Cowork Prysme.",
    h1: "Bureaux privatifs",
  },
  {
    path: "/salle-de-reunion",
    title: "Salles de réunion Lyon 7",
    description:
      "Salles de réunion équipées à Lyon 7 : visioconférence, formation, séminaire. Réservez à l'heure ou à la demi-journée.",
    h1: "Salles de réunion",
  },
  {
    path: "/tarifs",
    title: "Tarifs coworking Lyon 7",
    description:
      "Découvrez nos tarifs transparents pour bureaux privatifs, coworking et salles de réunion à Lyon 7.",
    h1: "Tarifs",
  },
  {
    path: "/services",
    title: "Services Cowork Prysme",
    description:
      "Room-service, afterwork, conciergerie et services premium pour simplifier votre quotidien au coworking.",
    h1: "Nos services",
  },
  {
    path: "/contact",
    title: "Contact & accès — Lyon 7",
    description:
      "Contactez Cowork Prysme à Lyon 7. Horaires, accès, plan et réservation de bureaux ou salles de réunion.",
    h1: "Contact & accès",
  },
  {
    path: "/coworking-lyon-7-jean-mace",
    title: "Coworking Lyon 7 Jean Macé",
    description:
      "Espace de coworking premium à Lyon 7, Jean Macé / Gerland. Bureaux flexibles et salles de réunion Cowork Prysme.",
    h1: "Coworking Lyon 7 Jean Macé",
  },
  {
    path: "/bureau-sans-engagement-lyon",
    title: "Bureau sans engagement Lyon",
    description:
      "Bureau flexible sans engagement à Lyon 7. Idéal freelances et TPE : formules adaptées à votre rythme.",
    h1: "Bureau sans engagement à Lyon",
  },
  {
    path: "/salle-reunion-a-lheure-lyon",
    title: "Salle de réunion à l'heure Lyon",
    description:
      "Louez une salle de réunion à l'heure à Lyon 7. Équipement pro, accueil premium, quartier Gerland.",
    h1: "Salle de réunion à l'heure à Lyon",
  },
  {
    path: "/coworking-freelance-lyon",
    title: "Coworking freelance Lyon",
    description:
      "Espace coworking pensé pour les freelances à Lyon 7 : réseau, flexibilité et cadre premium.",
    h1: "Coworking pour freelances à Lyon",
  },
  {
    path: "/bureau-teletravail-lyon",
    title: "Bureau télétravail Lyon 7",
    description:
      "Un bureau pour télétravailler à Lyon 7, au calme et bien connecté. Cowork Prysme, Gerland / Jean Macé.",
    h1: "Bureau télétravail Lyon",
  },
  {
    path: "/domiciliation-entreprise-lyon-7",
    title: "Domiciliation entreprise Lyon 7",
    description:
      "Solution de domiciliation d'entreprise à Lyon 7. Adresse professionnelle et services Cowork Prysme.",
    h1: "Domiciliation entreprise Lyon 7",
  },
  {
    path: "/coworking-startup-lyon",
    title: "Coworking startup Lyon",
    description:
      "Accueillez votre startup dans un coworking premium à Lyon 7. Bureaux évolutifs et salles de réunion.",
    h1: "Coworking startup Lyon",
  },
  {
    path: "/location-bureaux-equipes-lyon",
    title: "Location bureaux équipes Lyon",
    description:
      "Louez des bureaux pour vos équipes à Lyon 7. Espaces modulables, services inclus, emplacement Gerland.",
    h1: "Location de bureaux pour équipes à Lyon",
  },
  {
    path: "/a-propos",
    title: "À propos de Cowork Prysme",
    description:
      "Découvrez l'histoire, la vision et l'équipe de Cowork Prysme, coworking premium à Lyon 7.",
    h1: "À propos",
  },
  {
    path: "/avis",
    title: "Avis clients Cowork Prysme",
    description: "Les avis de nos membres et clients sur Cowork Prysme, coworking à Lyon 7.",
    h1: "Avis clients",
  },
  {
    path: "/faq",
    title: "FAQ — Cowork Prysme",
    description:
      "Questions fréquentes sur nos espaces, tarifs, accès et réservations à Cowork Prysme Lyon 7.",
    h1: "FAQ",
  },
  {
    path: "/mentions-legales",
    title: "Mentions légales",
    description: "Mentions légales du site Cowork Prysme.",
    h1: "Mentions légales",
    noIndex: true,
  },
  {
    path: "/politique-de-confidentialite",
    title: "Politique de confidentialité",
    description: "Politique de confidentialité et protection des données — Cowork Prysme.",
    h1: "Politique de confidentialité",
    noIndex: true,
  },
];

export function getStubPage(path: string): PageSeoConfig | undefined {
  return STUB_PAGES.find((page) => page.path === path);
}

export const ALL_SITEMAP_PATHS = [
  "/",
  ...STUB_PAGES.filter((page) => !page.noIndex).map((page) => page.path),
];
