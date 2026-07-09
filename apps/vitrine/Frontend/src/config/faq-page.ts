export interface FaqLink {
  href: string;
  label: string;
}

export interface FaqItem {
  id: string;
  question: string;
  /** Concise answer for featured snippets and JSON-LD lead. */
  lead: string;
  detail?: string;
  links?: FaqLink[];
}

export interface FaqGroup {
  id: string;
  title: string;
  items: FaqItem[];
}

export const FAQ_PAGE = {
  title: "Questions fréquentes",
  subtitle:
    "Réservation, accès sur place, facturation et protection des données — les réponses essentielles, sans détour.",
  groups: [
    {
      id: "reservation",
      title: "Réservation",
      items: [
        {
          id: "comment-reserver",
          question: "Comment réserver un espace chez CoworkPrysme ?",
          lead: "La réservation se fait directement en ligne depuis notre site : choisissez votre type d'espace (bureau ou salle de réunion), la date et le nombre de personnes, puis suivez le tunnel de réservation en quelques étapes.",
          detail:
            "Vous pouvez aussi nous contacter par téléphone ou email pour les réservations longue durée ou récurrentes.",
          links: [
            { href: "/bureaux-privatifs", label: "Bureaux privatifs" },
            { href: "/salle-de-reunion", label: "Salles de réunion" },
            { href: "/contact", label: "Contact & accès" },
          ],
        },
        {
          id: "reservation-recurrente",
          question: "Puis-je réserver pour plusieurs semaines ou de façon récurrente ?",
          lead: "Oui. Pour les réservations de plus de 3 semaines ou les réservations récurrentes (par exemple tous les lundis pendant plusieurs semaines), notre équipe dédiée prend le relais pour construire une formule adaptée à votre besoin.",
          links: [{ href: "/contact", label: "Contactez-nous" }],
        },
        {
          id: "compte-requis",
          question: "Dois-je créer un compte pour réserver ?",
          lead: "Un compte est nécessaire pour finaliser votre réservation — il vous permet ensuite de retrouver l'historique de vos réservations, vos factures et vos codes tarifaires.",
          detail: "La création se fait en quelques instants au moment de la réservation.",
        },
        {
          id: "dupliquer-reservation",
          question: "Puis-je dupliquer une réservation précédente ?",
          lead: "Oui, si vous avez déjà un compte client, vous pouvez retrouver vos réservations passées et en dupliquer une en un clic depuis votre espace client.",
        },
      ],
    },
    {
      id: "sur-place",
      title: "Sur place",
      items: [
        {
          id: "equipements-salle",
          question: "Quels équipements sont inclus dans les salles de réunion ?",
          lead: "Selon les salles : vidéoprojecteur, écran, système de visioconférence, paperboard, wifi fibre.",
          detail: "Le détail des équipements est indiqué sur la fiche de chaque espace.",
          links: [{ href: "/salle-de-reunion", label: "Nos salles de réunion" }],
        },
        {
          id: "acces-batiment",
          question: "Comment accéder au bâtiment le jour de ma réservation ?",
          lead: "La veille de votre arrivée, vous recevez un email avec le code d'accès au bâtiment et à votre espace réservé, ainsi qu'un mot de bienvenue.",
        },
        {
          id: "parking",
          question: "Y a-t-il un parking sur place ?",
          lead: "Oui, 22 places sont attribuées à CoworkPrysme et à ses visiteurs, au tarif de 20€ par jour.",
          links: [{ href: "/tarifs", label: "Consulter nos tarifs" }],
        },
        {
          id: "transports",
          question: "Le site est-il accessible en transports en commun ?",
          lead: "Oui : bus 64 (arrêt Pr Bernard), tramway T6 (Challemel-Lacours Artillerie), métro B (Stade de Gerland).",
          detail: "Le tramway T9 arrivera directement au pied de l'immeuble fin 2026.",
          links: [{ href: "/contact", label: "Plan d'accès détaillé" }],
        },
      ],
    },
    {
      id: "facturation-annulation",
      title: "Facturation & annulation",
      items: [
        {
          id: "conditions-annulation",
          question: "Quelles sont les conditions d'annulation ?",
          lead: "Elles varient selon la durée de votre réservation (à l'heure, à la journée, à la semaine, au mois).",
          detail:
            "Le détail complet des délais et taux de remboursement est disponible dans nos Conditions Générales de Vente.",
          links: [{ href: "/cgv", label: "Conditions Générales de Vente" }],
        },
        {
          id: "remboursement",
          question: "Puis-je me faire rembourser si j'annule ma réservation ?",
          lead: "Selon le délai avant votre réservation et sa durée, vous pouvez bénéficier d'un remboursement intégral, partiel, ou non remboursable en cas d'annulation tardive ou de non-présentation.",
          detail: "Voir le détail dans nos CGV.",
          links: [{ href: "/cgv", label: "Conditions Générales de Vente" }],
        },
        {
          id: "facture",
          question: "Comment recevoir ma facture ?",
          lead: "Une facture proforma vous est envoyée automatiquement dès la confirmation de votre réservation. La facture définitive (acquittée) vous parvient après règlement complet.",
          detail: "Vous pouvez également les retrouver à tout moment dans votre espace client.",
        },
        {
          id: "moyens-paiement",
          question: "Quels moyens de paiement acceptez-vous ?",
          lead: "Carte bancaire (paiement en ligne sécurisé), virement bancaire, ou prélèvement automatique pour les clients récurrents.",
        },
      ],
    },
    {
      id: "vos-donnees",
      title: "Vos données",
      items: [
        {
          id: "protection-donnees",
          question: "Comment sont protégées mes données personnelles ?",
          lead: "Vos données sont traitées conformément au RGPD.",
          detail:
            "Nous détaillons les finalités, durées de conservation et vos droits dans notre Politique de Confidentialité.",
          links: [{ href: "/politique-de-confidentialite", label: "Politique de Confidentialité" }],
        },
        {
          id: "suppression-donnees",
          question: "Puis-je demander la suppression de mes données ?",
          lead: "Oui, vous disposez d'un droit à l'effacement de vos données, sous réserve de l'absence de factures en cours ou de litiges ouverts.",
          detail: "Contactez-nous à contact@prysme.eu pour en faire la demande.",
          links: [{ href: "/contact", label: "Contact & accès" }],
        },
      ],
    },
  ] satisfies FaqGroup[],
  relatedLinks: [
    { href: "/cgv", label: "Conditions Générales de Vente" },
    { href: "/politique-de-confidentialite", label: "Politique de confidentialité" },
    { href: "/tarifs", label: "Tarifs" },
    { href: "/contact", label: "Contact & accès" },
  ],
  cta: {
    label: "Nous contacter",
    href: "/contact",
  },
} as const;

export const FAQ_PAGE_SEO = {
  title: "FAQ — Réservation, accès et tarifs | Cowork Prysme Lyon 7",
  description:
    "Questions fréquentes sur la réservation, l'accès, le parking, l'annulation, la facturation et vos données personnelles chez Cowork Prysme, Lyon 7.",
  path: "/faq",
} as const;

/** Plain-text answer for schema.org JSON-LD (no HTML). */
export function faqItemPlainAnswer(item: FaqItem): string {
  return [item.lead, item.detail].filter(Boolean).join(" ");
}

export const FAQ_ALL_ITEMS: FaqItem[] = FAQ_PAGE.groups.flatMap((group) => group.items);
