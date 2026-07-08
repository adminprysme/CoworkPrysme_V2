export const HOME_CONTENT = {
  hero: {
    title: "Le lieu qui donne de l'élan à vos événements",
    subtitle:
      "Réunions, séminaires, formations ou travail au quotidien : des espaces flexibles au cœur de Lyon 7.",
  },
  marquee: "Le Tramway T9 arrive au pied de l'immeuble à la fin de l'automne 2026",
  concept: {
    eyebrow: "Le Concept",
    title: "Et si votre espace de travail s'adaptait à votre rythme ?",
    body: "CoworkPrysme réunit en un seul lieu des bureaux privatifs, espaces de coworking, salles de réunion et espaces événementiels pour simplifier votre quotidien et accompagner chaque moment de votre activité.",
  },
  audiences: {
    eyebrow: "À qui s'adressent nos espaces ?",
    title: "Des espaces pensés pour chaque étape de votre activité",
    profiles: [
      {
        title: "Freelances & Indépendants",
        description:
          "Un cadre professionnel, une communauté bienveillante et la flexibilité dont vous avez besoin.",
        icon: "user",
      },
      {
        title: "Startups & TPE",
        description:
          "Des bureaux évolutifs et des salles de réunion pour accueillir clients, équipes et investisseurs.",
        icon: "rocket",
      },
      {
        title: "Travailleurs nomades & Télétravailleurs",
        description: "Travaillez au calme, bien connecté, à deux pas de Gerland et Jean Macé.",
        icon: "laptop",
      },
      {
        title: "Grandes entreprises & Équipes projets",
        description:
          "Des espaces modulables pour vos projets, séminaires et équipes en déplacement.",
        icon: "building",
      },
      {
        title: "Étudiants & Porteurs de projets",
        description:
          "Un environnement stimulant pour avancer sur vos études, side projects et premières idées.",
        icon: "lightbulb",
      },
    ],
    reasons: {
      title: "Pourquoi nous choisir ?",
      items: [
        {
          title: "Flexibilité",
          description: "Des formules à la carte, sans contraintes inutiles.",
        },
        {
          title: "Communauté",
          description: "Un réseau actif, des échanges et des événements réguliers.",
        },
        {
          title: "Emplacement",
          description: "Lyon 7, Gerland / Jean Macé, proche transports et axes majeurs.",
        },
        {
          title: "Services",
          description: "Conciergerie, room-service et services premium sur place.",
        },
      ],
    },
  },
  services: {
    eyebrow: "Nos services",
    title: "Tout ce qu'il faut pour vous concentrer sur l'essentiel",
    items: [
      {
        title: "Room-Service",
        description: "Restauration et boissons livrées directement dans votre espace.",
        href: "/services",
        image:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Afterwork",
        description: "Des moments conviviaux pour fédérer votre équipe ou votre communauté.",
        href: "/services",
        image:
          "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: "Conciergerie",
        description: "Accueil, courrier, services du quotidien : on s'occupe du reste.",
        href: "/services",
        image:
          "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80",
      },
    ],
  },
} as const;
