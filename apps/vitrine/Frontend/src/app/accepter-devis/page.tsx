import { Suspense } from "react";

import { AcceptQuotePageContent } from "@/components/accept-quote/AcceptQuotePageContent";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Accepter le devis",
  description: "Acceptez votre devis Cowork Prysme et créez votre compte si besoin.",
  path: "/accepter-devis",
  noIndex: true,
});

export default function AccepterDevisPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "3rem 1.25rem", textAlign: "center" }}>Chargement du devis…</div>
      }
    >
      <AcceptQuotePageContent />
    </Suspense>
  );
}
