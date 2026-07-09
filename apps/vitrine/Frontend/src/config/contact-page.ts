export type TransportIconId = "bus" | "tram" | "metro" | "taxi" | "bike" | "car" | "parking";

export interface TransportLine {
  icon: TransportIconId;
  label: string;
  detail: string;
  href?: string;
  note?: string;
}

export const CONTACT_PAGE = {
  title: "Nous trouver",
  parking: {
    title: "Accès Parking",
    places: "22 places attribuées à Cowork Prysme et Visiteurs",
    rate: "Tarif : 20 € par jour",
  },
  buildingAccess: {
    title: "Bâtiment A1 — instructions d'accès",
    steps: [
      "L'entrée dans le bâtiment A1 se fait par l'entrée principale située le long de la grille devant la rue Saint Jean de Dieu. Il faut suivre l'allée devant la grille.",
      "Un interphone se trouve devant la porte : sonner à CoworkPrysme.",
    ],
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
      {
        icon: "taxi",
        label: "Taxis (tarif C)",
        detail: "CoworkPrysme → Lyon Part-Dieu, 18 € à 24 €",
      },
    ] satisfies TransportLine[],
  },
  bikeWalk: {
    title: "Nous rejoindre à vélo ou à pied",
    description: "CoworkPrysme – Bellecour : 30 minutes via la piste V-L01",
    href: "https://avelo.grandlyon.com/se-deplacer-a-velo/la-carto-du-velo",
    linkLabel: "Plan des pistes cyclables de Lyon",
  },
  car: {
    title: "Nous rejoindre en voiture",
    chargingNearby: "Stations de recharge véhicule électrique à proximité : CNR & Engie",
    onSiteCharging: "Pas de station de recharge sur site",
  },
  map: {
    title: "Plan d'accès",
    openLabel: "Ouvrir dans Google Maps",
  },
} as const;
