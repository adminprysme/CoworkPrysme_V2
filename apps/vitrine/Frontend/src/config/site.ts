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
    title: "Coworking à Jean Macé, Lyon 7 — CoworkPrysme",
    description:
      "Un espace de coworking en plein cœur de Lyon 7, quartier Jean Macé / Gerland. Bureaux, salles de réunion, accès tramway. Découvrez CoworkPrysme.",
    h1: "Votre espace de coworking dans le quartier Jean Macé, Lyon 7",
  },
  {
    path: "/bureau-sans-engagement-lyon",
    title: "Bureau sans engagement à Lyon — Location flexible | CoworkPrysme",
    description:
      "Louez un bureau à Lyon sans engagement long terme : à la journée, à la semaine ou au mois. Résiliez librement. Découvrez nos formules flexibles.",
    h1: "Un bureau à Lyon, sans vous engager sur la durée",
  },
  {
    path: "/salle-reunion-a-lheure-lyon",
    title: "Location salle de réunion à l'heure à Lyon | CoworkPrysme",
    description:
      "Réservez une salle de réunion à l'heure à Lyon 7, équipée (vidéoprojecteur, visio, wifi fibre). Disponibilité en temps réel, réservation en 2 minutes.",
    h1: "Louez une salle de réunion à l'heure, à Lyon 7",
  },
  {
    path: "/coworking-freelance-lyon",
    title: "Coworking pour freelances à Lyon — Réseau & flexibilité | CoworkPrysme",
    description:
      "Espace de coworking pensé pour les freelances lyonnais : tarifs à la journée, réseau actif, cadre propice pour recevoir vos clients. Rejoignez la communauté.",
    h1: "Le coworking des freelances lyonnais",
  },
  {
    path: "/bureau-teletravail-lyon",
    title: "Bureau télétravail à Lyon — Espace calme et connecté | CoworkPrysme",
    description:
      "Un espace dédié pour télétravailler à Lyon 7 : wifi fibre, cadre calme, proche transports. Sortez de chez vous sans perdre en confort de travail.",
    h1: "Télétravaillez dans un vrai cadre professionnel, à Lyon 7",
  },
  {
    path: "/domiciliation-entreprise-lyon-7",
    title: "Domiciliation d'entreprise à Lyon 7 — CoworkPrysme",
    description:
      "Domiciliez votre entreprise à Lyon 7, quartier Jean Macé. Adresse professionnelle, gestion du courrier, inclus dès un mois de location de bureau.",
    h1: "Domiciliez votre entreprise à Lyon 7",
  },
  {
    path: "/coworking-startup-lyon",
    title: "Coworking pour startups à Lyon — Écosystème & croissance | CoworkPrysme",
    description:
      "Un espace de coworking pensé pour les startups lyonnaises : bureaux modulables, réseau d'entrepreneurs, salles pour vos événements. Grandissez avec nous.",
    h1: "L'espace qui grandit avec votre startup",
  },
  {
    path: "/location-bureaux-equipes-lyon",
    title: "Location de bureaux pour équipes à Lyon | CoworkPrysme",
    description:
      "Louez des bureaux pour votre équipe à Lyon 7 : capacité jusqu'à 100 personnes, facturation simplifiée, contrats entreprise. Un espace externe pour vos projets.",
    h1: "Des bureaux et salles pour vos équipes, à Lyon 7",
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
