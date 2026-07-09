export interface AboutDistinguisher {
  title: string;
  description: string;
}

export const ABOUT_PAGE = {
  title: "Notre histoire",
  subtitle:
    "Un coworking premium pensé pour celles et ceux qui veulent travailler autrement, au cœur de Lyon 7.",
  vision: {
    eyebrow: "Notre ADN",
    title: "Une vision",
    body: "CoworkPrysme est né d'une conviction simple : le travail ne devrait pas s'accommoder d'un choix binaire entre l'isolement du télétravail et la rigidité d'un bail commercial classique. À Lyon 7, au cœur du quartier Jean Macé / Gerland, nous avons voulu créer un lieu qui s'adapte au rythme de ceux qui l'occupent — freelances, startups, équipes en mission, entreprises en croissance.",
  },
  distinguishers: {
    eyebrow: "Ce qui fait la différence",
    title: "Ce qui nous distingue",
    lead: "Quatre piliers qui guident notre façon d'accueillir les professionnels au quotidien.",
    items: [
      {
        title: "Flexibilité réelle",
        description:
          "Pas de bail contraignant : des formules à la carte, à l'heure ou au mois, qui évoluent avec votre activité sans vous enfermer dans un engagement long terme.",
      },
      {
        title: "Une communauté active",
        description:
          "Des parcours qui se croisent, des échanges informels qui deviennent des collaborations — un écosystème vivant, pas un open space silencieux.",
      },
      {
        title: "Un emplacement pensé pour l'accessibilité",
        description:
          "Tramway, pistes cyclables, parking à proximité — et bientôt le T9 au pied de l'immeuble. Vos clients et vos équipes arrivent facilement, vous aussi.",
      },
      {
        title: "Des services pour vous simplifier la vie",
        description:
          "Accueil, conciergerie, équipements professionnels et prestations sur place : tout est pensé pour que vous vous concentriez sur l'essentiel.",
      },
    ] satisfies AboutDistinguisher[],
  },
  place: {
    eyebrow: "Gerland Technopark",
    title: "Le lieu",
    body: "CoworkPrysme occupe le bâtiment A1 au 39 rue Saint Jean de Dieu, Lyon 7 — un cadre contemporain au sein du Gerland Technopark, entre Jean Macé et Gerland. Lumière, espaces modulables et finitions soignées : un environnement de travail qui inspire confiance, que vous receviez un client ou que vous montiez en charge sur un projet.",
    address: "Bâtiment A1 — 39 rue Saint Jean de Dieu, 69007 Lyon",
    imageAlt: "Façade du bâtiment A1 — CoworkPrysme, Lyon 7 (photo à venir)",
    imageCaption: "Galerie photos à venir",
  },
  cta: {
    label: "Découvrir nos espaces",
    href: "/bureaux-privatifs",
  },
  relatedLinks: [
    { href: "/services", label: "Nos services" },
    { href: "/contact", label: "Contact & accès" },
    { href: "/coworking-lyon-7-jean-mace", label: "Coworking Lyon 7 Jean Macé" },
  ],
} as const;

export const ABOUT_PAGE_SEO = {
  title: "Notre histoire — Cowork Prysme, coworking à Lyon 7",
  description:
    "Vision, valeurs et lieu : découvrez l'histoire de Cowork Prysme, espace de travail flexible au bâtiment A1, 39 rue Saint Jean de Dieu, Lyon 7.",
  path: "/a-propos",
} as const;
