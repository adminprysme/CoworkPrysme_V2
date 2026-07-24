import { ServicesPageContent } from "@/components/services/ServicesPageContent";
import { createPageMetadata } from "@/lib/metadata";
import { getServicesContent } from "@/lib/get-services-content";

export const metadata = createPageMetadata({
  title: "Nos Services — Room-service, Afterwork & Conciergerie Lyon 7",
  description:
    "Room-service, afterwork et conciergerie au coworking Cowork Prysme à Lyon 7, Gerland / Jean Macé. Des prestations premium pour votre confort au quotidien.",
  path: "/services",
});

export default async function ServicesPage() {
  const servicesContent = await getServicesContent();

  return (
    <ServicesPageContent
      serviceImages={servicesContent.serviceImages}
      featuredSpaces={servicesContent.featuredSpaces}
    />
  );
}
