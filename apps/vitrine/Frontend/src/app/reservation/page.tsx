import type { Metadata } from "next";

import { BookingPageContent } from "@/components/booking/BookingPageContent";
import { createPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Réserver un espace",
  description:
    "Recherchez et réservez un bureau privatif ou une salle de réunion disponible chez Cowork Prysme.",
  path: "/reservation",
});

export default function ReservationPage() {
  return <BookingPageContent />;
}
