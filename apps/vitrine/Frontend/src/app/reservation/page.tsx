import type { Metadata } from "next";

import { DEFAULT_SITE_CONTACT } from "@coworkprysme/shared";

import { BookingPageContent } from "@/components/booking/BookingPageContent";
import { getSiteContact } from "@/lib/get-building-info";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Réserver un espace",
  description:
    "Recherchez et réservez un bureau privatif ou une salle de réunion disponible chez Cowork Prysme.",
  path: "/reservation",
});

export default async function ReservationPage() {
  const contact = await getSiteContact();

  return <BookingPageContent contactEmail={contact.email ?? DEFAULT_SITE_CONTACT.email} />;
}
