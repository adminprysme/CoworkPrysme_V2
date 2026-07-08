export interface ServiceDetail {
  id: "roomService" | "afterwork" | "conciergerie";
  title: string;
  description: string;
  imageFallback: string;
}

export interface SpacePreview {
  name: string;
  type: "private_office" | "meeting_room";
  capacity: number;
  description: string;
  equipment: string[];
  href: string;
  image: string;
}

export const SERVICES_PAGE = {
  title: "Nos Services",
  subtitle: "Des prestations sur mesure pour votre confort",
  services: [
    {
      id: "roomService",
      title: "Room-Service",
      description:
        "Petit-déjeuner, déjeuner ou pause café : notre room-service vous livre directement dans votre bureau ou salle de réunion. Des formules adaptées aux réunions, séminaires et journées intensives, avec une sélection soignée pour un coworking premium au cœur de Lyon 7.",
      imageFallback:
        "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    },
    {
      id: "afterwork",
      title: "Afterwork",
      description:
        "Fédérez vos équipes ou votre communauté dans un cadre convivial et soigné. Nous vous accompagnons pour organiser vos afterworks, lancements ou moments informels : espaces dédiés, scénographie légère et logistique simplifiée pour profiter pleinement du moment.",
      imageFallback:
        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80",
    },
    {
      id: "conciergerie",
      title: "Conciergerie",
      description:
        "Accueil des visiteurs, gestion du courrier, réservations et petites attentions du quotidien : la conciergerie Cowork Prysme vous libère du superflu pour vous concentrer sur l'essentiel. Un service discret et réactif, pensé pour les professionnels exigeants.",
      imageFallback:
        "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80",
    },
  ] satisfies ServiceDetail[],
  spacesPreview: {
    eyebrow: "Nos espaces",
    title: "Fiches produits de quelques espaces",
    lead: "Un aperçu de nos bureaux privatifs et salles de réunion — disponibilités et réservation en ligne prochainement.",
    items: [
      {
        name: "Bureau Privatif Gerland",
        type: "private_office",
        capacity: 4,
        description:
          "Bureau lumineux avec postes individuels, idéal pour une équipe en croissance ou un dirigeant recherchant calme et confidentialité.",
        equipment: ["Fibre", "Climatisation", "Armoire", "Table de réunion"],
        href: "/bureaux-privatifs",
        image:
          "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80",
      },
      {
        name: "Salle Boardroom",
        type: "meeting_room",
        capacity: 12,
        description:
          "Salle de réunion équipée pour comités de direction, visioconférences et sessions de travail en petit comité.",
        equipment: ["Écran 4K", "Visio", "Table modulable", "Paperboard"],
        href: "/salle-de-reunion",
        image:
          "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&w=900&q=80",
      },
      {
        name: "Salle Atelier Formation",
        type: "meeting_room",
        capacity: 20,
        description:
          "Volume généreux en disposition classe ou U, pensé pour formations, workshops et séminaires d'une journée.",
        equipment: ["Vidéoprojecteur", "Sonorisation", "Tables modulables", "Lumière du jour"],
        href: "/salle-de-reunion",
        image:
          "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=900&q=80",
      },
    ] satisfies SpacePreview[],
  },
} as const;
