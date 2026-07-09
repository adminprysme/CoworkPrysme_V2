export interface ServiceDetail {
  id: "roomService" | "afterwork" | "conciergerie";
  title: string;
  description: string;
  imageFallback: string;
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
  },
} as const;
