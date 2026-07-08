import { ContactPageContent } from "@/components/contact/ContactPageContent";
import { createPageMetadata } from "@/lib/metadata";
import { getBuildingInfo } from "@/lib/get-building-info";

export const metadata = createPageMetadata({
  title: "Nous trouver — Contact & accès Lyon 7",
  description:
    "Adresse, parking, transports et plan d'accès du coworking Cowork Prysme à Lyon 7, Gerland / Jean Macé. Bâtiment A1 Technopark, accès tram, métro et vélo.",
  path: "/contact",
});

export default async function ContactPage() {
  const building = await getBuildingInfo();

  return <ContactPageContent building={building} />;
}
