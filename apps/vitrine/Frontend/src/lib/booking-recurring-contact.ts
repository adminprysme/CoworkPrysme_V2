import type { SpaceType } from "@coworkprysme/shared";

const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  meeting_room: "Salle de réunion",
  private_office: "Bureau privatif",
};

/**
 * Self-service booking handles continuous date ranges only.
 * Recurring or non-consecutive needs (e.g. every Monday for 8 weeks) are routed
 * to manual handling via a pre-filled email to the site contact address.
 */
export function buildRecurringReservationMailto(
  contactEmail: string,
  context: {
    spaceType: SpaceType;
    partySize: number;
  },
): string {
  const subject = encodeURIComponent("Demande de réservation récurrente — Cowork Prysme");
  const body = encodeURIComponent(
    [
      "Bonjour,",
      "",
      "Je souhaite une réservation récurrente ou sur mesure (ex. tous les lundis pendant plusieurs semaines).",
      "",
      `Type d'espace : ${SPACE_TYPE_LABELS[context.spaceType]}`,
      `Nombre de personnes : ${context.partySize}`,
      "",
      "Merci de me recontacter pour construire une formule adaptée.",
      "",
    ].join("\n"),
  );

  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
}
