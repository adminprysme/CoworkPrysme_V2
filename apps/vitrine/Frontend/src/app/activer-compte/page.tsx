import { Suspense } from "react";

import { ActivateAccountPageContent } from "@/components/activate-account/ActivateAccountPageContent";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Activer mon compte",
  description: "Définissez votre mot de passe pour activer votre compte Cowork Prysme.",
  path: "/activer-compte",
  noIndex: true,
});

export default function ActiverComptePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "3rem 1.25rem", textAlign: "center" }}>
          Chargement de l&apos;activation…
        </div>
      }
    >
      <ActivateAccountPageContent />
    </Suspense>
  );
}
