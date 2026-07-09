import type { SpaceType } from "@coworkprysme/shared";

export type CatalogPageKind = "private_offices" | "meeting_rooms" | "tariffs";

export interface CatalogPageConfig {
  kind: CatalogPageKind;
  spaceType?: SpaceType;
  basePath: string;
  titleTemplate: (buildingName: string) => string;
  descriptionTemplate: (buildingName: string, city: string) => string;
  heroEyebrow: string;
  introFallback: string;
  emptyMessage: string;
  relatedLinks: Array<{ href: string; label: string }>;
}

export const PRIVATE_OFFICES_CATALOG: CatalogPageConfig = {
  kind: "private_offices",
  spaceType: "private_office",
  basePath: "/bureaux-privatifs",
  titleTemplate: (buildingName) => `Bureaux privatifs — ${buildingName} | Cowork Prysme`,
  descriptionTemplate: (buildingName, city) =>
    `Louez un bureau privatif chez ${buildingName} à ${city} : espaces calmes, flexibles et premium.`,
  heroEyebrow: "Bureaux privatifs",
  introFallback:
    "Des bureaux privatifs modulables, équipés et prêts à accueillir vos équipes ou vos clients dans un cadre professionnel.",
  emptyMessage:
    "Aucun bureau privatif disponible pour le moment. Contactez-nous pour être informé des prochaines disponibilités.",
  relatedLinks: [
    { href: "/coworking-lyon-7-jean-mace", label: "Coworking Lyon 7 Jean Macé" },
    { href: "/tarifs", label: "Tarifs" },
    { href: "/contact", label: "Contact & accès" },
  ],
};

export const MEETING_ROOMS_CATALOG: CatalogPageConfig = {
  kind: "meeting_rooms",
  spaceType: "meeting_room",
  basePath: "/salle-de-reunion",
  titleTemplate: (buildingName) => `Salles de réunion — ${buildingName} | Cowork Prysme`,
  descriptionTemplate: (buildingName, city) =>
    `Réservez une salle de réunion à ${buildingName}, ${city} : équipements pro, lumière naturelle, accès facile.`,
  heroEyebrow: "Salles de réunion",
  introFallback:
    "Des salles de réunion équipées pour vos réunions clients, workshops et présentations, à la demi-journée ou à la journée.",
  emptyMessage:
    "Aucune salle de réunion disponible pour le moment. Contactez-nous pour connaître les prochaines ouvertures.",
  relatedLinks: [
    { href: "/salle-reunion-heure", label: "Salle de réunion à l'heure" },
    { href: "/tarifs", label: "Tarifs" },
    { href: "/contact", label: "Contact & accès" },
  ],
};

export const TARIFS_CATALOG: CatalogPageConfig = {
  kind: "tariffs",
  basePath: "/tarifs",
  titleTemplate: (buildingName) => `Tarifs — ${buildingName} | Cowork Prysme`,
  descriptionTemplate: (buildingName, city) =>
    `Consultez les tarifs HT des bureaux privatifs et salles de réunion à ${buildingName}, ${city}.`,
  heroEyebrow: "Tarifs",
  introFallback:
    "Tarifs transparents pour bureaux privatifs et salles de réunion, adaptés à vos besoins ponctuels ou récurrents.",
  emptyMessage: "Aucun tarif publié pour ce bâtiment pour le moment.",
  relatedLinks: [
    { href: "/bureaux-privatifs", label: "Bureaux privatifs" },
    { href: "/salle-de-reunion", label: "Salles de réunion" },
    { href: "/contact", label: "Demander un devis" },
  ],
};
