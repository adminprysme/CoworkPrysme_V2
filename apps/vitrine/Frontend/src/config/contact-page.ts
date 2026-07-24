export type TransportIconId =
  "transit" | "bus" | "tram" | "metro" | "taxi" | "bike" | "car" | "parking" | "walk";

export type DirectionsModeId = "transit" | "taxi" | "bike" | "car" | "walk";

export interface TransportLine {
  icon: TransportIconId;
  label: string;
  detail: string;
  href?: string;
  note?: string;
}

export interface BuildingAccessStep {
  label: string;
  description: string;
  highlight?: string;
}

export const CONTACT_PAGE = {
  title: "Nous trouver",
  buildingAccess: {
    eyebrow: "Bâtiment A1",
    title: "Instructions d'accès",
    steps: [
      {
        label: "Entrée principale",
        description:
          "L'entrée dans le bâtiment A1 se fait par l'entrée principale située le long de la grille devant la rue Saint Jean de Dieu. Il faut suivre l'allée devant la grille.",
      },
      {
        label: "Interphone",
        description: "Un interphone se trouve devant la porte : sonner à",
        highlight: "CoworkPrysme",
      },
    ] satisfies BuildingAccessStep[],
  },
  publicTransport: {
    title: "Nous rejoindre en transport en commun",
    lines: [
      {
        icon: "bus",
        label: "Bus 64",
        detail: "Arrêt Pr Bernard",
        href: "https://www.tcl.fr",
      },
      {
        icon: "tram",
        label: "Tramway T6",
        detail: "Arrêt Challemel-Lacour / Artillerie",
        href: "https://www.tcl.fr",
      },
      {
        icon: "tram",
        label: "Tramway T10",
        detail: "Arrêt Saint Jean de Dieu",
        href: "https://www.tcl.fr",
        note: "Ouverture prévue en 2027",
      },
      {
        icon: "metro",
        label: "Métro B",
        detail: "Arrêt Stade de Gerland",
        href: "https://www.tcl.fr",
      },
    ] satisfies TransportLine[],
  },
  directions: {
    title: "Nous rejoindre",
    modes: [
      { id: "transit", label: "Transport", icon: "transit" },
      { id: "taxi", label: "Taxi", icon: "taxi" },
      { id: "bike", label: "Vélo", icon: "bike" },
      { id: "car", label: "Voiture", icon: "car" },
      { id: "walk", label: "À pied", icon: "walk" },
    ] satisfies { id: DirectionsModeId; label: string; icon: TransportIconId }[],
    taxi: {
      label: "Taxis (tarif C)",
      detail: "CoworkPrysme → Lyon Part-Dieu, 18 € à 24 €",
    },
    bike: {
      description: "CoworkPrysme → Bellecour : 30 minutes via la piste V-L01",
      href: "https://avelo.grandlyon.com/se-deplacer-a-velo/la-carto-du-velo",
      linkLabel: "Plan des pistes cyclables de Lyon",
      directionsLabel: "Itinéraire vélo depuis ma position",
    },
    walk: {
      description:
        "CoworkPrysme → Bellecour : environ 45 minutes à pied via les quais du Rhône et le centre-ville.",
      directionsLabel: "Itinéraire à pied depuis ma position",
    },
  },
  car: {
    title: "Nous rejoindre en voiture",
    parkingTitle: "Accès parking",
    parkingPlaces: "22 places attribuées à Cowork Prysme et Visiteurs",
    parkingRate: "À partir de 20 € par jour",
    chargingNearby: "Stations de recharge véhicule électrique à proximité : CNR & Engie",
    onSiteCharging: "Pas de station de recharge sur site",
    directionsLabel: "Itinéraire depuis ma position",
  },
  map: {
    title: "Plan d'accès",
    openLabel: "Ouvrir dans Google Maps",
  },
} as const;
