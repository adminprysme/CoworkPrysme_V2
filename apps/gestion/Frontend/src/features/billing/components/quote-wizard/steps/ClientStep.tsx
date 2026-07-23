import { useEffect, useRef, useState } from "react";
import type {
  BookingClientKind,
  QuoteProspect,
  StaffBillingClientSearchItem,
} from "@coworkprysme/shared";
import { isValidSiretDigits, lookupCompanyBySiret } from "@coworkprysme/shared";

import { searchBillingClients } from "../../../../../lib/billing-quotes-api.js";
import pageStyles from "../../../BillingPages.module.css";
import styles from "../QuoteWizard.module.css";
import { createDefaultProspect } from "../../../lib/quote-wizard-state.js";

type ClientMode = "search" | "new";

type ClientStepProps = {
  prospect: QuoteProspect;
  cardexId: string;
  clientAccountId: string;
  onChange: (next: { prospect: QuoteProspect; cardexId: string; clientAccountId: string }) => void;
};

function emptyAddress(): NonNullable<QuoteProspect["billingAddress"]> {
  return { street: "", zip: "", city: "", country: "FR" };
}

function ensureAddress(prospect: QuoteProspect): NonNullable<QuoteProspect["billingAddress"]> {
  return prospect.billingAddress ?? emptyAddress();
}

export function ClientStep({ prospect, cardexId, clientAccountId, onChange }: ClientStepProps) {
  const hasExisting = Boolean(cardexId && clientAccountId);
  const [mode, setMode] = useState<ClientMode>(
    hasExisting ? "search" : prospect.email ? "new" : "search",
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StaffBillingClientSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(
    hasExisting ? "Client existant sélectionné" : null,
  );
  const [siretLookupLoading, setSiretLookupLoading] = useState(false);
  const [siretLookupMessage, setSiretLookupMessage] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const clientKind: BookingClientKind = prospect.clientKind ?? "individual";

  function emit(next: { prospect: QuoteProspect; cardexId: string; clientAccountId: string }) {
    onChange(next);
  }

  function patchProspect(patch: Partial<QuoteProspect>) {
    emit({
      prospect: { ...prospect, ...patch },
      cardexId: "",
      clientAccountId: "",
    });
    setSelectedLabel(null);
  }

  function patchAddress(patch: Partial<NonNullable<QuoteProspect["billingAddress"]>>) {
    const billingAddress = { ...ensureAddress(prospect), ...patch };
    patchProspect({ billingAddress });
  }

  useEffect(() => {
    if (mode !== "search") return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const seq = ++searchSeq.current;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void searchBillingClients(trimmed)
        .then((response) => {
          if (seq !== searchSeq.current) return;
          setResults(response.clients);
        })
        .catch((error: unknown) => {
          if (seq !== searchSeq.current) return;
          setResults([]);
          setSearchError(error instanceof Error ? error.message : "Recherche impossible.");
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, 280);

    return () => window.clearTimeout(timer);
  }, [mode, query]);

  function selectExisting(item: StaffBillingClientSearchItem) {
    emit({
      prospect: createDefaultProspect(),
      cardexId: item.cardexId,
      clientAccountId: item.clientAccountId,
    });
    setSelectedLabel(item.label);
    setQuery("");
    setResults([]);
  }

  function startNewClient() {
    setMode("new");
    setSelectedLabel(null);
    setResults([]);
    setQuery("");
    emit({
      prospect: {
        ...createDefaultProspect(),
        clientKind: "individual",
        billingAddress: emptyAddress(),
      },
      cardexId: "",
      clientAccountId: "",
    });
  }

  function backToSearch() {
    setMode("search");
    setSiretLookupMessage(null);
    emit({
      prospect: createDefaultProspect(),
      cardexId: "",
      clientAccountId: "",
    });
    setSelectedLabel(null);
  }

  async function handleSiretLookup() {
    setSiretLookupMessage(null);
    if (!isValidSiretDigits(prospect.siret ?? "")) {
      setSiretLookupMessage("SIRET invalide (14 chiffres).");
      return;
    }
    setSiretLookupLoading(true);
    try {
      const outcome = await lookupCompanyBySiret(prospect.siret ?? "");
      if (outcome.status === "ok") {
        const company = outcome.company;
        patchProspect({
          siret: company.siret,
          companyName: company.legalName,
          vatNumber: company.vatNumber,
          billingAddress: {
            street: company.address.street,
            zip: company.address.zip,
            city: company.address.city,
            country: "FR",
          },
        });
        setSiretLookupMessage("Entreprise trouvée — champs préremplis (modifiables).");
        return;
      }
      if (outcome.status === "invalid_siret") {
        setSiretLookupMessage("SIRET invalide (14 chiffres).");
      } else if (outcome.status === "not_found") {
        setSiretLookupMessage("Aucune entreprise trouvée pour ce SIRET.");
      } else {
        setSiretLookupMessage(
          "Service de recherche indisponible. Saisissez les champs manuellement.",
        );
      }
    } finally {
      setSiretLookupLoading(false);
    }
  }

  const address = ensureAddress(prospect);

  return (
    <section className={styles.panel} aria-labelledby="quote-client-title">
      <h2 id="quote-client-title" className={styles.panelTitle}>
        Client
      </h2>
      <p className={pageStyles.muted}>
        Recherchez un client existant ou créez un prospect. Les identifiants techniques restent en
        arrière-plan — l’acceptation créera le dossier si besoin.
      </p>

      {mode === "search" ? (
        <div className={styles.clientSearchBlock}>
          {selectedLabel && hasExisting ? (
            <div className={styles.selectedClient} role="status">
              <div>
                <strong>Client sélectionné</strong>
                <div className={pageStyles.muted}>{selectedLabel}</div>
              </div>
              <button
                type="button"
                className={pageStyles.secondaryButton}
                onClick={() => {
                  emit({
                    prospect: createDefaultProspect(),
                    cardexId: "",
                    clientAccountId: "",
                  });
                  setSelectedLabel(null);
                }}
              >
                Changer
              </button>
            </div>
          ) : null}

          <label className={pageStyles.label}>
            Rechercher un client
            <input
              className={pageStyles.input}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Email, nom ou société (min. 2 caractères)"
              autoComplete="off"
            />
          </label>

          {searching ? <p className={pageStyles.muted}>Recherche…</p> : null}
          {searchError ? (
            <p className={styles.ko} role="alert">
              {searchError}
            </p>
          ) : null}

          {results.length > 0 ? (
            <ul className={styles.searchResults} role="listbox" aria-label="Résultats clients">
              {results.map((item) => (
                <li key={item.cardexId}>
                  <button
                    type="button"
                    className={styles.searchResultBtn}
                    onClick={() => selectExisting(item)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {query.trim().length >= 2 && !searching && results.length === 0 && !searchError ? (
            <p className={pageStyles.muted}>Aucun client trouvé.</p>
          ) : null}

          <div className={styles.clientActions}>
            <button type="button" className={pageStyles.primaryButton} onClick={startNewClient}>
              Nouveau client
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.clientNewBlock}>
          <div className={styles.clientActions}>
            <button type="button" className={pageStyles.secondaryButton} onClick={backToSearch}>
              ← Retour à la recherche
            </button>
          </div>

          <div className={styles.kindToggle} role="radiogroup" aria-label="Type de client">
            <button
              type="button"
              role="radio"
              aria-checked={clientKind === "individual"}
              className={[
                styles.kindOption,
                clientKind === "individual" ? styles.kindOptionSelected : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() =>
                patchProspect({
                  clientKind: "individual",
                  companyName: "",
                  siret: "",
                  vatNumber: "",
                })
              }
            >
              Particulier
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={clientKind === "company"}
              className={[
                styles.kindOption,
                clientKind === "company" ? styles.kindOptionSelected : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => patchProspect({ clientKind: "company" })}
            >
              Professionnel
            </button>
          </div>

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
              Prénom *
              <input
                className={pageStyles.input}
                value={prospect.firstName ?? ""}
                onChange={(event) => patchProspect({ firstName: event.target.value })}
              />
            </label>
            <label className={pageStyles.label}>
              Nom *
              <input
                className={pageStyles.input}
                value={prospect.lastName ?? ""}
                onChange={(event) => patchProspect({ lastName: event.target.value })}
              />
            </label>
            <label className={pageStyles.label}>
              Téléphone <span className={pageStyles.muted}>(optionnel)</span>
              <input
                className={pageStyles.input}
                type="tel"
                value={prospect.phone ?? ""}
                onChange={(event) => patchProspect({ phone: event.target.value })}
              />
            </label>
          </div>

          {clientKind === "company" ? (
            <div className={styles.companyBlock}>
              <div className={styles.siretRow}>
                <label className={pageStyles.label}>
                  SIRET *
                  <input
                    className={pageStyles.input}
                    value={prospect.siret ?? ""}
                    onChange={(event) => patchProspect({ siret: event.target.value })}
                    placeholder="14 chiffres"
                    inputMode="numeric"
                  />
                </label>
                <button
                  type="button"
                  className={pageStyles.secondaryButton}
                  disabled={siretLookupLoading}
                  onClick={() => void handleSiretLookup()}
                >
                  {siretLookupLoading ? "Recherche…" : "Rechercher"}
                </button>
              </div>
              {siretLookupMessage ? (
                <p className={pageStyles.muted} role="status">
                  {siretLookupMessage}
                </p>
              ) : null}
              <div className={pageStyles.fieldGrid}>
                <label className={pageStyles.label}>
                  Raison sociale *
                  <input
                    className={pageStyles.input}
                    value={prospect.companyName ?? ""}
                    onChange={(event) => patchProspect({ companyName: event.target.value })}
                  />
                </label>
                <label className={pageStyles.label}>
                  N° TVA
                  <input
                    className={pageStyles.input}
                    value={prospect.vatNumber ?? ""}
                    onChange={(event) => patchProspect({ vatNumber: event.target.value })}
                  />
                </label>
              </div>
            </div>
          ) : null}

          <fieldset className={styles.addressFieldset}>
            <legend>{clientKind === "company" ? "Adresse de facturation *" : "Adresse *"}</legend>
            <div className={pageStyles.fieldGrid}>
              <label className={pageStyles.label}>
                Rue
                <input
                  className={pageStyles.input}
                  value={address.street}
                  onChange={(event) => patchAddress({ street: event.target.value })}
                />
              </label>
              <label className={pageStyles.label}>
                Code postal
                <input
                  className={pageStyles.input}
                  value={address.zip}
                  onChange={(event) => patchAddress({ zip: event.target.value })}
                />
              </label>
              <label className={pageStyles.label}>
                Ville
                <input
                  className={pageStyles.input}
                  value={address.city}
                  onChange={(event) => patchAddress({ city: event.target.value })}
                />
              </label>
            </div>
          </fieldset>
        </div>
      )}
    </section>
  );
}
