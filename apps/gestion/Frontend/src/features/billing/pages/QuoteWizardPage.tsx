import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type {
  BuildingResponse,
  ServiceResponse,
  SpaceResponse,
  StaffCreateQuoteRequest,
  StaffQuote,
  StaffUpdateQuoteRequest,
} from "@coworkprysme/shared";

import { fetchBuildings } from "../../../lib/buildings-api.js";
import {
  acquireQuoteLocks,
  checkQuoteAvailability,
  createQuote,
  getQuote,
  refreshQuoteLocks,
  releaseQuoteLocks,
  sendQuote,
  updateQuote,
} from "../../../lib/billing-quotes-api.js";
import { fetchServices } from "../../../lib/services-api.js";
import { fetchSpacesByBuilding } from "../../../lib/spaces-api.js";
import pageStyles from "../BillingPages.module.css";
import {
  buildQuoteLines,
  createInitialWizardState,
  fromDatetimeLocalValue,
  prospectForApi,
  QUOTE_WIZARD_STEPS,
  toDatetimeLocalValue,
  validateClientStep,
  type QuoteWizardState,
  type WizardSpaceSlot,
} from "../lib/quote-wizard-state.js";
import styles from "../components/quote-wizard/QuoteWizard.module.css";
import { ClientStep } from "../components/quote-wizard/steps/ClientStep.js";
import { ConditionsStep } from "../components/quote-wizard/steps/ConditionsStep.js";
import { PricingStep } from "../components/quote-wizard/steps/PricingStep.js";
import { RecapStep } from "../components/quote-wizard/steps/RecapStep.js";
import { ServicesStep } from "../components/quote-wizard/steps/ServicesStep.js";
import { SpacesStep } from "../components/quote-wizard/steps/SpacesStep.js";

function applyQuoteToState(quote: StaffQuote): QuoteWizardState {
  const base = createInitialWizardState();
  const spaceSlots: WizardSpaceSlot[] = quote.lines
    .filter((line) => line.kind === "space" && line.spaceId && line.startAt && line.endAt)
    .map((line) => ({
      key: line.lineId.replace(/^space-/, "") || crypto.randomUUID(),
      buildingId: line.buildingId ?? "",
      spaceId: line.spaceId!,
      spaceName: line.label,
      startLocal: toDatetimeLocalValue(line.startAt!),
      endLocal: toDatetimeLocalValue(line.endAt!),
      partySize: line.partySize ?? 1,
    }));

  const servicePicks = quote.lines
    .filter((line) => line.kind === "service")
    .map((line) => ({
      serviceId: line.lineId.replace(/^service-/, ""),
      label: line.label,
      priceHTCents: line.calculatedUnitPriceHT,
      vatRate: line.vatRate,
      qty: line.qty,
    }));

  const overrides = quote.lines
    .filter((line) => line.priceSource === "forced" && line.forcedUnitPriceHT !== undefined)
    .map((line) => ({
      lineId: line.lineId,
      forcedUnitPriceHT: line.forcedUnitPriceHT!,
      priceOverrideReason: line.priceOverrideReason ?? "",
    }));

  return {
    ...base,
    quoteId: quote.id,
    reference: quote.reference,
    status: quote.status,
    cardexId: quote.cardexId ?? "",
    clientAccountId: quote.clientAccountId ?? "",
    prospect: quote.prospect ?? base.prospect,
    spaces: spaceSlots,
    services: servicePicks,
    overrides,
    depositPercent: quote.depositPercent,
    paymentSituation: quote.paymentSituation ?? "",
    paymentMethodPreferred: quote.paymentMethodPreferred ?? "",
    validUntilLocal: toDatetimeLocalValue(quote.validUntil),
    internalNote: quote.internalNote ?? "",
    publicConditions: quote.publicConditions ?? "",
    paymentTermsLabel: quote.paymentTermsLabel ?? "",
  };
}

export function QuoteWizardPage() {
  const { quoteId: routeQuoteId } = useParams<{ quoteId?: string }>();
  const navigate = useNavigate();
  const isNew = !routeQuoteId || routeQuoteId === "new";

  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<QuoteWizardState>(createInitialWizardState);
  const [lastSaved, setLastSaved] = useState<StaffQuote | null>(null);
  const [buildings, setBuildings] = useState<BuildingResponse[]>([]);
  const [spacesByBuilding, setSpacesByBuilding] = useState<Map<string, SpaceResponse[]>>(
    () => new Map(),
  );
  const [services, setServices] = useState<ServiceResponse[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const spaceCatalog = useMemo(() => {
    const map = new Map<string, SpaceResponse>();
    for (const list of spacesByBuilding.values()) {
      for (const space of list) map.set(space.id, space);
    }
    return map;
  }, [spacesByBuilding]);

  const serviceCatalog = useMemo(() => {
    const map = new Map<string, ServiceResponse>();
    for (const service of services) map.set(service.id, service);
    return map;
  }, [services]);

  const lines = useMemo(
    () =>
      buildQuoteLines({
        spaces: state.spaces,
        spaceCatalog,
        services: state.services,
        serviceCatalog,
        overrides: state.overrides,
      }),
    [state.spaces, state.services, state.overrides, spaceCatalog, serviceCatalog],
  );

  const closeModal = useCallback(() => {
    if (busy || sending) return;
    navigate("/billing/quotes");
  }, [busy, navigate, sending]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeModal]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const [buildingsRes, servicesRes] = await Promise.all([
          fetchBuildings(),
          fetchServices("active"),
        ]);
        if (cancelled) return;
        setBuildings(buildingsRes.buildings);
        setServices(servicesRes.services);
        const spaceEntries = await Promise.all(
          buildingsRes.buildings.map(async (building) => {
            const spacesRes = await fetchSpacesByBuilding(building.id);
            return [building.id, spacesRes.spaces] as const;
          }),
        );
        if (cancelled) return;
        setSpacesByBuilding(new Map(spaceEntries));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de charger le catalogue.");
        }
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isNew || !routeQuoteId) return;
    let cancelled = false;
    async function loadQuote() {
      setLoading(true);
      setError(null);
      try {
        const quote = await getQuote(routeQuoteId!);
        if (cancelled) return;
        setState(applyQuoteToState(quote));
        setLastSaved(quote);
        if (quote.status !== "draft") {
          setError("Seul un devis brouillon est éditable dans le wizard.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Devis introuvable.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadQuote();
    return () => {
      cancelled = true;
    };
  }, [isNew, routeQuoteId]);

  useEffect(() => {
    if (!state.quoteId || !state.locksExpiresAt) return;
    const timer = window.setInterval(() => {
      void refreshQuoteLocks({ quoteDraftId: state.quoteId! })
        .then((result) => {
          setState((prev) => ({ ...prev, locksExpiresAt: result.expiresAt }));
        })
        .catch(() => {
          // lock may have expired — ignore soft refresh errors
        });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [state.quoteId, state.locksExpiresAt]);

  useEffect(() => {
    return () => {
      if (state.quoteId && state.locksExpiresAt) {
        void releaseQuoteLocks({ quoteDraftId: state.quoteId }).catch(() => undefined);
      }
    };
    // only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional unmount release
  }, []);

  const patchState = useCallback((patch: Partial<QuoteWizardState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  function buildCreatePayload(): StaffCreateQuoteRequest {
    const validUntil = fromDatetimeLocalValue(state.validUntilLocal);
    if (!validUntil) {
      throw new Error("Date de validité invalide.");
    }
    const prospect = prospectForApi(state.prospect);
    return {
      ...(state.cardexId ? { cardexId: state.cardexId } : {}),
      ...(state.clientAccountId ? { clientAccountId: state.clientAccountId } : {}),
      ...(prospect ? { prospect } : {}),
      lines,
      depositPercent: state.depositPercent,
      ...(state.paymentSituation ? { paymentSituation: state.paymentSituation } : {}),
      ...(state.paymentMethodPreferred
        ? { paymentMethodPreferred: state.paymentMethodPreferred }
        : {}),
      validUntil,
      ...(state.internalNote.trim() ? { internalNote: state.internalNote.trim() } : {}),
      ...(state.publicConditions.trim() ? { publicConditions: state.publicConditions.trim() } : {}),
      ...(state.paymentTermsLabel.trim()
        ? { paymentTermsLabel: state.paymentTermsLabel.trim() }
        : {}),
    };
  }

  function buildUpdatePayload(): StaffUpdateQuoteRequest {
    const validUntil = fromDatetimeLocalValue(state.validUntilLocal);
    if (!validUntil) {
      throw new Error("Date de validité invalide.");
    }
    const prospect = prospectForApi(state.prospect);
    return {
      cardexId: state.cardexId || null,
      clientAccountId: state.clientAccountId || null,
      prospect: prospect ?? null,
      lines,
      depositPercent: state.depositPercent,
      ...(state.paymentSituation ? { paymentSituation: state.paymentSituation } : {}),
      ...(state.paymentMethodPreferred
        ? { paymentMethodPreferred: state.paymentMethodPreferred }
        : {}),
      validUntil,
      internalNote: state.internalNote.trim() || null,
      publicConditions: state.publicConditions.trim() || null,
      paymentTermsLabel: state.paymentTermsLabel.trim() || null,
    };
  }

  async function ensureDraftSaved(): Promise<StaffQuote> {
    if (state.quoteId) {
      const updated = await updateQuote(state.quoteId, buildUpdatePayload());
      setLastSaved(updated);
      patchState({
        quoteId: updated.id,
        reference: updated.reference,
        status: updated.status,
      });
      return updated;
    }
    const created = await createQuote(buildCreatePayload());
    setLastSaved(created);
    patchState({
      quoteId: created.id,
      reference: created.reference,
      status: created.status,
    });
    if (isNew) {
      navigate(`/billing/quotes/${created.id}`, { replace: true });
    }
    return created;
  }

  async function handleNext() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (stepIndex === 0) {
        const clientError = validateClientStep({
          cardexId: state.cardexId,
          clientAccountId: state.clientAccountId,
          prospect: state.prospect,
        });
        if (clientError) {
          throw new Error(clientError);
        }
        await ensureDraftSaved();
      } else if (stepIndex === 3 || stepIndex === 4) {
        await ensureDraftSaved();
      }
      setStepIndex((prev) => Math.min(prev + 1, QUOTE_WIZARD_STEPS.length - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Étape suivante impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckAvailability() {
    setBusy(true);
    setError(null);
    try {
      const draft = await ensureDraftSaved();
      const slots = state.spaces
        .map((slot) => {
          const startAt = fromDatetimeLocalValue(slot.startLocal);
          const endAt = fromDatetimeLocalValue(slot.endLocal);
          if (!slot.spaceId || !startAt || !endAt) return null;
          return {
            spaceId: slot.spaceId,
            startAt,
            endAt,
            partySize: slot.partySize,
          };
        })
        .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));
      if (slots.length === 0) {
        throw new Error("Renseignez au moins un créneau complet.");
      }
      const result = await checkQuoteAvailability({
        slots,
        quoteDraftId: draft.id,
      });
      patchState({
        spaces: state.spaces.map((slot) => {
          const startAt = fromDatetimeLocalValue(slot.startLocal);
          const match = result.results.find(
            (item) =>
              item.spaceId === slot.spaceId &&
              item.startAt === startAt &&
              item.endAt === fromDatetimeLocalValue(slot.endLocal),
          );
          if (!match) return slot;
          return {
            ...slot,
            available: match.available,
            availabilityReason: match.reason,
          };
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vérification impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAcquireLocks() {
    setBusy(true);
    setError(null);
    try {
      const draft = await ensureDraftSaved();
      const slots = state.spaces
        .map((slot) => {
          const startAt = fromDatetimeLocalValue(slot.startLocal);
          const endAt = fromDatetimeLocalValue(slot.endLocal);
          if (!slot.spaceId || !startAt || !endAt) return null;
          return {
            spaceId: slot.spaceId,
            startAt,
            endAt,
            partySize: slot.partySize,
          };
        })
        .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));
      if (slots.length === 0) {
        throw new Error("Renseignez au moins un créneau complet.");
      }
      const result = await acquireQuoteLocks({
        quoteDraftId: draft.id,
        slots,
      });
      patchState({ locksExpiresAt: result.expiresAt });
      setInfo("Créneaux verrouillés pour le wizard.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verrouillage impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await ensureDraftSaved();
      setInfo("Brouillon enregistré.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    setInfo(null);
    try {
      const draft = await ensureDraftSaved();
      const result = await sendQuote(draft.id);
      setLastSaved(result.quote);
      patchState({ status: result.quote.status });
      setInfo(
        result.emailSent
          ? "Devis envoyé (email délivré)."
          : "Devis passé en envoyé (email non délivré — vérifier SMTP).",
      );
      navigate("/billing/quotes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  }

  const step = QUOTE_WIZARD_STEPS[stepIndex]!;
  const title = state.reference ? `Devis ${state.reference}` : "Nouveau devis";

  return (
    <div className={styles.overlay} role="presentation" onClick={closeModal}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-wizard-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.dialogAccent} aria-hidden="true" />

        <header className={styles.modalHeader}>
          <div className={styles.modalHeaderMain}>
            <h2 id="quote-wizard-title" className={styles.modalTitle}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={closeModal}
            aria-label="Fermer"
            disabled={busy || sending}
          >
            ×
          </button>
        </header>

        <div className={styles.steps} role="tablist" aria-label="Étapes du devis">
          {QUOTE_WIZARD_STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === stepIndex}
              className={`${styles.step} ${index === stepIndex ? styles.stepActive : ""} ${
                index < stepIndex ? styles.stepDone : ""
              }`}
              onClick={() => setStepIndex(index)}
            >
              {index + 1}. {item.label}
            </button>
          ))}
        </div>

        <div className={styles.modalBody}>
          {loading ? <p className={pageStyles.muted}>Chargement du devis…</p> : null}

          {!loading && error ? <p className={pageStyles.error}>{error}</p> : null}
          {!loading && info ? <p className={pageStyles.success}>{info}</p> : null}

          {!loading && step.id === "client" ? (
            <ClientStep
              prospect={state.prospect}
              cardexId={state.cardexId}
              clientAccountId={state.clientAccountId}
              onChange={(next) =>
                patchState({
                  prospect: next.prospect,
                  cardexId: next.cardexId,
                  clientAccountId: next.clientAccountId,
                })
              }
            />
          ) : null}

          {!loading && step.id === "spaces" ? (
            <SpacesStep
              slots={state.spaces}
              buildings={buildings}
              spacesByBuilding={spacesByBuilding}
              locksExpiresAt={state.locksExpiresAt}
              busy={busy}
              onChange={(spaces) => patchState({ spaces })}
              onCheckAvailability={() => void handleCheckAvailability()}
              onAcquireLocks={() => void handleAcquireLocks()}
            />
          ) : null}

          {!loading && step.id === "services" ? (
            <ServicesStep
              catalog={services}
              selected={state.services}
              onChange={(next) => patchState({ services: next })}
            />
          ) : null}

          {!loading && step.id === "pricing" ? (
            <PricingStep
              lines={lines}
              depositPercent={state.depositPercent}
              overrides={state.overrides}
              onDepositChange={(depositPercent) => patchState({ depositPercent })}
              onOverridesChange={(overrides) => patchState({ overrides })}
            />
          ) : null}

          {!loading && step.id === "conditions" ? (
            <ConditionsStep
              paymentMethodPreferred={state.paymentMethodPreferred}
              paymentSituation={state.paymentSituation}
              validUntilLocal={state.validUntilLocal}
              internalNote={state.internalNote}
              publicConditions={state.publicConditions}
              paymentTermsLabel={state.paymentTermsLabel}
              onChange={(patch) => patchState(patch)}
            />
          ) : null}

          {!loading && step.id === "recap" ? (
            <RecapStep
              state={state}
              lines={lines}
              lastSaved={lastSaved}
              sending={sending}
              onSaveDraft={() => void handleSaveDraft()}
              onSend={() => void handleSend()}
            />
          ) : null}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={pageStyles.secondaryButton}
            disabled={stepIndex === 0 || busy || loading}
            onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
          >
            Précédent
          </button>
          <div className={styles.footerRight}>
            {step.id !== "recap" ? (
              <button
                type="button"
                className={pageStyles.primaryButton}
                disabled={busy || loading}
                onClick={() => void handleNext()}
              >
                {busy ? "…" : "Suivant"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
