import { ConnexionPageContent } from "@/components/connexion/ConnexionPageContent";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Connexion",
  description: "Connectez-vous à votre espace client Cowork Prysme.",
  path: "/connexion",
  noIndex: true,
});

export default function ConnexionPage() {
  return <ConnexionPageContent />;
}
