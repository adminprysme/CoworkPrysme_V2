import { Suspense } from "react";

import { InvitationPageContent } from "@/components/invitation/InvitationPageContent";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Invitation collaborateur",
  description: "Créez votre compte collaborateur Cowork Prysme à partir d'une invitation.",
  path: "/invitation",
  noIndex: true,
});

export default function InvitationPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "3rem 1.25rem", textAlign: "center" }}>
          Chargement de l&apos;invitation…
        </div>
      }
    >
      <InvitationPageContent />
    </Suspense>
  );
}
