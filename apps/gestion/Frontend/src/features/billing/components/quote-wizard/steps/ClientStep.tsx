import type { QuoteProspect } from "@coworkprysme/shared";

import pageStyles from "../../BillingPages.module.css";
import styles from "./QuoteWizard.module.css";

type ClientStepProps = {
  prospect: QuoteProspect;
  cardexId: string;
  clientAccountId: string;
  onChange: (next: { prospect: QuoteProspect; cardexId: string; clientAccountId: string }) => void;
};

export function ClientStep({ prospect, cardexId, clientAccountId, onChange }: ClientStepProps) {
  function patchProspect(patch: Partial<QuoteProspect>) {
    onChange({
      prospect: { ...prospect, ...patch },
      cardexId,
      clientAccountId,
    });
  }

  return (
    <section className={styles.panel} aria-labelledby="quote-client-title">
      <h2 id="quote-client-title" className={styles.panelTitle}>
        Client / prospect
      </h2>
      <p className={pageStyles.muted}>
        Saisissez l’identité prospect. Un cardex/compte n’est pas requis pour envoyer le devis —
        l’acceptation créera le dossier si besoin (#8).
      </p>

      <div className={pageStyles.fieldGrid}>
        <label className={pageStyles.label}>
          Email *
          <input
            className={pageStyles.input}
            type="email"
            required
            value={prospect.email}
            onChange={(event) => patchProspect({ email: event.target.value })}
          />
        </label>
        <label className={pageStyles.label}>
          Nom d’affichage
          <input
            className={pageStyles.input}
            value={prospect.displayName ?? ""}
            onChange={(event) => patchProspect({ displayName: event.target.value })}
            placeholder="Ou prénom + nom"
          />
        </label>
        <label className={pageStyles.label}>
          Prénom
          <input
            className={pageStyles.input}
            value={prospect.firstName ?? ""}
            onChange={(event) => patchProspect({ firstName: event.target.value })}
          />
        </label>
        <label className={pageStyles.label}>
          Nom
          <input
            className={pageStyles.input}
            value={prospect.lastName ?? ""}
            onChange={(event) => patchProspect({ lastName: event.target.value })}
          />
        </label>
        <label className={pageStyles.label}>
          Téléphone
          <input
            className={pageStyles.input}
            value={prospect.phone ?? ""}
            onChange={(event) => patchProspect({ phone: event.target.value })}
          />
        </label>
        <label className={pageStyles.label}>
          Société
          <input
            className={pageStyles.input}
            value={prospect.companyName ?? ""}
            onChange={(event) => patchProspect({ companyName: event.target.value })}
          />
        </label>
      </div>

      <div className={pageStyles.fieldGrid}>
        <label className={pageStyles.label}>
          Cardex ID (optionnel)
          <input
            className={pageStyles.input}
            value={cardexId}
            onChange={(event) =>
              onChange({ prospect, cardexId: event.target.value.trim(), clientAccountId })
            }
            placeholder="24 caractères hex"
          />
        </label>
        <label className={pageStyles.label}>
          Compte client ID (optionnel)
          <input
            className={pageStyles.input}
            value={clientAccountId}
            onChange={(event) =>
              onChange({ prospect, cardexId, clientAccountId: event.target.value.trim() })
            }
            placeholder="24 caractères hex"
          />
        </label>
      </div>
    </section>
  );
}
