import { SITE_URL } from "@/config/site";

export interface SeoLandingSection {
  title: string;
  body: string;
}

export interface SeoLandingRelatedLink {
  href: string;
  label: string;
}

export interface SeoLandingPageConfig {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: [SeoLandingSection, SeoLandingSection];
  cta: {
    label: string;
    href: string;
  };
  relatedLinks: SeoLandingRelatedLink[];
  ogImage: string;
}

const OG = {
  quartier: `${SITE_URL}/images/seo/coworking-jean-mace-exterieur.jpg`,
  flex: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&h=630&q=80",
  reunion: `${SITE_URL}/images/seo/salle-reunion-reservation.webp`,
  freelance:
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&h=630&q=80",
  teletravail: `${SITE_URL}/images/seo/bureau-teletravail.jpg`,
  domiciliation:
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&h=630&q=80",
  startup:
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&h=630&q=80",
  equipes:
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&h=630&q=80",
} as const;

export const SEO_LANDING_PAGES: SeoLandingPageConfig[] = [
  {
    path: "/coworking-lyon-7-jean-mace",
    title: "Coworking à Jean Macé, Lyon 7 — CoworkPrysme",
    description:
      "Un espace de coworking en plein cœur de Lyon 7, quartier Jean Macé / Gerland. Bureaux, salles de réunion, accès tramway. Découvrez CoworkPrysme.",
    h1: "Votre espace de coworking dans le quartier Jean Macé, Lyon 7",
    intro:
      "Entre Jean Macé et Gerland, CoworkPrysme s'est installé au 39 rue Saint Jean de Dieu, à deux pas des axes qui font vivre ce quartier en pleine transformation. Ici, pas de trajet interminable vers le centre-ville : votre bureau est à portée de tramway.",
    sections: [
      {
        title: "Un quartier qui bouge",
        body: "Jean Macé et Gerland concentrent aujourd'hui une vraie dynamique entrepreneuriale — écoles, entreprises tech, artisans, associations. Travailler ici, c'est profiter d'un bassin d'activité local sans renoncer à l'accessibilité : Bus 64 (Pr Bernard), Tram T6 (Challemel-Lacours Artillerie), Métro B (Stade de Gerland), et bientôt le T9 directement au pied de l'immeuble (fin 2026) puis le T10 (2027).",
      },
      {
        title: "Un ancrage de proximité",
        body: "Nos membres viennent souvent du quartier — ils gagnent le temps du trajet. Parking dédié (22 places, 20€/jour), accès vélo facilité.",
      },
    ],
    cta: { label: "Découvrir nos espaces à Jean Macé", href: "/bureaux-privatifs" },
    relatedLinks: [
      { href: "/salle-de-reunion", label: "Salles de réunion" },
      { href: "/contact", label: "Contact & accès" },
    ],
    ogImage: OG.quartier,
  },
  {
    path: "/bureau-sans-engagement-lyon",
    title: "Bureau sans engagement à Lyon — Location flexible | CoworkPrysme",
    description:
      "Louez un bureau à Lyon sans engagement long terme : à la journée, à la semaine ou au mois. Résiliez librement. Découvrez nos formules flexibles.",
    h1: "Un bureau à Lyon, sans vous engager sur la durée",
    intro:
      "Bail commercial de 3-6-9 ans, caution, préavis interminable : la location de bureau classique n'est pas faite pour tout le monde. Chez CoworkPrysme, vous choisissez la durée qui vous convient — et vous en changez quand votre activité évolue.",
    sections: [
      {
        title: "Comment ça marche",
        body: "Réservez à l'heure, à la journée, à la semaine ou au mois. Pour un engagement plus long, un simple préavis de 30 jours suffit à résilier — le mois entamé reste dû, rien de plus. Aucune caution disproportionnée, aucune clause cachée.",
      },
      {
        title: "Pour qui",
        body: "Les indépendants qui testent une activité, les entreprises en attente de leurs propres locaux, les équipes en mission temporaire à Lyon.",
      },
    ],
    cta: { label: "Voir les formules et tarifs", href: "/tarifs" },
    relatedLinks: [
      { href: "/bureaux-privatifs", label: "Bureaux privatifs" },
      { href: "/coworking-freelance-lyon", label: "Coworking freelance" },
    ],
    ogImage: OG.flex,
  },
  {
    path: "/salle-reunion-a-lheure-lyon",
    title: "Location salle de réunion à l'heure à Lyon | CoworkPrysme",
    description:
      "Réservez une salle de réunion à l'heure à Lyon 7, équipée (vidéoprojecteur, visio, wifi fibre). Disponibilité en temps réel, réservation en 2 minutes.",
    h1: "Louez une salle de réunion à l'heure, à Lyon 7",
    intro:
      "Un entretien client, un point d'équipe, une session de travail collective : pas besoin de louer une salle à la journée quand vous n'avez besoin que de deux heures. Réservez exactement le temps qu'il vous faut.",
    sections: [
      {
        title: "Réservation immédiate",
        body: "Consultez les disponibilités en temps réel sur notre planning en ligne, sélectionnez votre créneau, confirmez — le tout en quelques minutes. Salles équipées : vidéoprojecteur, écran, visioconférence, wifi fibre, paperboard sur demande.",
      },
      {
        title: "Des capacités pour tous les formats",
        body: "De la salle pour 4 personnes au format 20 places pour vos réunions élargies.",
      },
    ],
    cta: { label: "Consulter le planning de disponibilité", href: "/salle-de-reunion" },
    relatedLinks: [
      { href: "/tarifs", label: "Tarifs" },
      { href: "/location-bureaux-equipes-lyon", label: "Bureaux pour équipes" },
    ],
    ogImage: OG.reunion,
  },
  {
    path: "/coworking-freelance-lyon",
    title: "Coworking pour freelances à Lyon — Réseau & flexibilité | CoworkPrysme",
    description:
      "Espace de coworking pensé pour les freelances lyonnais : tarifs à la journée, réseau actif, cadre propice pour recevoir vos clients. Rejoignez la communauté.",
    h1: "Le coworking des freelances lyonnais",
    intro:
      "Graphiste, développeur, consultant, rédacteur : travailler seul ne veut pas dire travailler isolé. CoworkPrysme réunit une communauté de professionnels indépendants dans un cadre pensé pour votre activité.",
    sections: [
      {
        title: "Sortir de l'isolement, sans perdre en concentration",
        body: "Espaces partagés pour l'énergie collective, zones calmes pour la concentration, salles de réunion pour recevoir vos clients dans un cadre professionnel.",
      },
      {
        title: "Des tarifs adaptés à l'activité freelance",
        body: "Journée, semaine, abonnement mensuel — payez selon votre rythme de mission, pas selon un forfait rigide.",
      },
    ],
    cta: { label: "Découvrir les tarifs freelance", href: "/tarifs" },
    relatedLinks: [
      { href: "/bureau-sans-engagement-lyon", label: "Bureau sans engagement" },
      { href: "/bureau-teletravail-lyon", label: "Bureau télétravail" },
    ],
    ogImage: OG.freelance,
  },
  {
    path: "/bureau-teletravail-lyon",
    title: "Bureau télétravail à Lyon — Espace calme et connecté | CoworkPrysme",
    description:
      "Un espace dédié pour télétravailler à Lyon 7 : wifi fibre, cadre calme, proche transports. Sortez de chez vous sans perdre en confort de travail.",
    h1: "Télétravaillez dans un vrai cadre professionnel, à Lyon 7",
    intro:
      "Le salon n'est pas un bureau. Quand le télétravail à domicile pèse — distractions, connexion limitée, absence de coupure entre vie pro et perso — CoworkPrysme offre une alternative à deux pas de chez vous.",
    sections: [
      {
        title: "Ce qui change",
        body: "Connexion fibre haut débit garantie, ergonomie de vrais postes de travail, environnement calme et concentré. Vous repartez le soir en ayant vraiment coupé.",
      },
      {
        title: "Accessible, sans contrainte",
        body: "Réservez à la journée quand vous en avez besoin, sans engagement. Accès tram/bus/métro à quelques minutes.",
      },
    ],
    cta: { label: "Réserver une journée de télétravail", href: "/bureaux-privatifs" },
    relatedLinks: [
      { href: "/coworking-freelance-lyon", label: "Coworking freelance" },
      { href: "/tarifs", label: "Tarifs" },
    ],
    ogImage: OG.teletravail,
  },
  {
    path: "/domiciliation-entreprise-lyon-7",
    title: "Domiciliation d'entreprise à Lyon 7 — CoworkPrysme",
    description:
      "Domiciliez votre entreprise à Lyon 7, quartier Jean Macé. Adresse professionnelle, gestion du courrier, inclus dès un mois de location de bureau.",
    h1: "Domiciliez votre entreprise à Lyon 7",
    intro:
      "Une adresse professionnelle crédible à Lyon, sans les frais d'un bail classique. CoworkPrysme propose la domiciliation d'entreprise pour les indépendants et sociétés qui veulent une implantation lyonnaise sérieuse.",
    sections: [
      {
        title: "Comment ça fonctionne",
        body: "Le service de domiciliation est inclus dès la location d'un bureau privatif à partir d'un mois. Réception et gestion de votre courrier, adresse utilisable pour votre Kbis et vos échanges administratifs.",
      },
      {
        title: "Avantages",
        body: "Adresse au 39 rue Saint Jean de Dieu, Lyon 7 — quartier reconnu, accès facile pour vos rendez-vous clients sur place si besoin.",
      },
    ],
    cta: { label: "Demander les conditions de domiciliation", href: "/contact" },
    relatedLinks: [
      { href: "/bureaux-privatifs", label: "Bureaux privatifs" },
      { href: "/coworking-startup-lyon", label: "Coworking startup" },
    ],
    ogImage: OG.domiciliation,
  },
  {
    path: "/coworking-startup-lyon",
    title: "Coworking pour startups à Lyon — Écosystème & croissance | CoworkPrysme",
    description:
      "Un espace de coworking pensé pour les startups lyonnaises : bureaux modulables, réseau d'entrepreneurs, salles pour vos événements. Grandissez avec nous.",
    h1: "L'espace qui grandit avec votre startup",
    intro:
      "Une équipe qui passe de 2 à 8 personnes en quelques mois, ça ne se prévoit pas toujours. CoworkPrysme propose des bureaux modulables qui s'adaptent à votre rythme de croissance, sans renégociation de bail à chaque étape.",
    sections: [
      {
        title: "Un écosystème, pas juste un bureau",
        body: "Networking entre équipes présentes sur site, salles de réunion pour vos points investisseurs, espaces événementiels pour vos lancements ou ateliers.",
      },
      {
        title: "Flexibilité budgétaire",
        body: "Ajustez votre espace au fil des levées et des recrutements, sans immobiliser de capital dans un bail long.",
      },
    ],
    cta: { label: "Discuter de votre projet startup", href: "/contact" },
    relatedLinks: [
      { href: "/location-bureaux-equipes-lyon", label: "Bureaux pour équipes" },
      { href: "/bureaux-privatifs", label: "Bureaux privatifs" },
    ],
    ogImage: OG.startup,
  },
  {
    path: "/location-bureaux-equipes-lyon",
    title: "Location de bureaux pour équipes à Lyon | CoworkPrysme",
    description:
      "Louez des bureaux pour votre équipe à Lyon 7 : capacité jusqu'à 100 personnes, facturation simplifiée, contrats entreprise. Un espace externe pour vos projets.",
    h1: "Des bureaux et salles pour vos équipes, à Lyon 7",
    intro:
      "Réunion d'équipe élargie, formation, atelier de travail collectif : quand vos locaux ne suffisent pas, CoworkPrysme met à disposition des espaces capables d'accueillir jusqu'à 100 personnes, avec une logistique pensée pour les entreprises.",
    sections: [
      {
        title: "Une capacité pour tous vos formats",
        body: "Bureaux d'équipe, salles de réunion modulables, espaces événementiels — un seul interlocuteur pour organiser votre venue.",
      },
      {
        title: "Simplicité administrative",
        body: "Facturation entreprise centralisée, contrats adaptés aux besoins récurrents ou ponctuels de vos équipes.",
      },
    ],
    cta: { label: "Demander un devis entreprise", href: "/contact" },
    relatedLinks: [
      { href: "/salle-de-reunion", label: "Salles de réunion" },
      { href: "/tarifs", label: "Tarifs" },
    ],
    ogImage: OG.equipes,
  },
];

export function getSeoLandingPage(path: string): SeoLandingPageConfig | undefined {
  return SEO_LANDING_PAGES.find((page) => page.path === path);
}
