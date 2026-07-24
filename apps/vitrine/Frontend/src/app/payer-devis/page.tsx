import { Suspense } from "react";

import { QuotePayPageContent } from "@/components/quote-pay/QuotePayPageContent";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Payer votre devis",
  description: "Réglez l'acompte ou le solde de votre devis Cowork Prysme par carte.",
  path: "/payer-devis",
  noIndex: true,
});

export default function PayerDevisPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "3rem 1.25rem", textAlign: "center" }}>Chargement du paiement…</div>
      }
    >
      <QuotePayPageContent />
    </Suspense>
  );
}
