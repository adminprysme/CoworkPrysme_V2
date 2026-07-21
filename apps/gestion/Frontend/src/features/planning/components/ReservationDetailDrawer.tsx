import { useCallback, useEffect, useId, useState } from "react";
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconCalendar,
  IconChevronDown,
  IconDoor,
} from "@tabler/icons-react";
import {
  formatAvailabilityWindow,
  formatServiceCustomAnswerValue,
  type PlanningReservationDetail,
  type PlanningServiceLine,
} from "@coworkprysme/shared";

import { fetchPlanningReservation } from "../../../lib/planning-api.js";
import {
  PaymentStatusBadge,
  RESERVATION_STATUS_LABELS,
  SPACE_TYPE_LABELS,
} from "../planning-ui.js";
import { formatCentsEur, formatDateTime } from "../planning-utils.js";
import { ReservationContactsPanel } from "./ReservationContactsPanel.js";
import { ReservationManagePanel } from "./ReservationManagePanel.js";
import styles from "./ReservationDetailDrawer.module.css";

type TabId = "summary" | "contacts" | "manage" | "documents";

export type PlanningDrawerTab = TabId;

const TAB_LABELS: Record<TabId, string> = {
  summary: "Résumé",
  contacts: "Contacts",
  manage: "Gérer",
  documents: "Documents",
};

function tabLabel(tab: TabId): string {
  return TAB_LABELS[tab];
}

interface ReservationDetailDrawerProps {
  reservationId: string;
  onClose: () => void;
  /** Open directly on a given tab (e.g. from context menu). */
  initialTab?: PlanningDrawerTab;
  onOpenReservation?: (reservationId: string) => void;
  /** Refresh calendar/occupancy after Manage mutations (restore, cancel, space change). */
  onReservationMutated?: () => void;
  /** Desktop/laptop only: expand detail over the planning (manual overlay). */
  fullscreen?: boolean;
  showFullscreenToggle?: boolean;
  onToggleFullscreen?: () => void;
}

function serviceAnswerCount(service: PlanningServiceLine): number {
  return service.customAnswers?.length ?? 0;
}

export function ReservationDetailDrawer({
  reservationId,
  onClose,
  initialTab = "summary",
  onOpenReservation,
  onReservationMutated,
  fullscreen = false,
  showFullscreenToggle = false,
  onToggleFullscreen,
}: ReservationDetailDrawerProps) {
  const titleId = useId();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [detail, setDetail] = useState<PlanningReservationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(
    (options?: { silent?: boolean }) => {
      let cancelled = false;
      if (!options?.silent) {
        setLoading(true);
        setError(null);
      }
      void fetchPlanningReservation(reservationId)
        .then((payload) => {
          if (!cancelled) {
            setDetail(payload);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Erreur de chargement");
            if (!options?.silent) {
              setDetail(null);
            }
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    },
    [reservationId],
  );

  useEffect(() => {
    setTab(initialTab);
    return loadDetail();
  }, [reservationId, loadDetail, initialTab]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const readOnly = detail?.readOnly ?? false;
  const paidTotal = detail?.invoice?.paidTotal ?? 0;
  const balanceDue = detail?.invoice?.balanceDue ?? detail?.pricing.totalTTC ?? 0;
  const settled = detail?.paymentStatus === "paid" || balanceDue === 0;

  return (
    <aside className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <p className={styles.breadcrumb} aria-label="Navigation du panneau">
            <span className={styles.breadcrumbPrimary}>{detail?.reference ?? "…"}</span>
            <span className={styles.breadcrumbSep} aria-hidden="true">
              /
            </span>
            <span className={styles.breadcrumbMode}>{tabLabel(tab)}</span>
          </p>
          {detail ? (
            <div className={styles.headerBadges}>
              <span
                className={styles.reservationStatusChip}
                data-status={detail.status}
                title="Statut réservation"
              >
                <span className={styles.badgeKind}>Réservation</span>
                {RESERVATION_STATUS_LABELS[detail.status] ?? detail.status}
              </span>
              <PaymentStatusBadge status={detail.paymentStatus} showKindLabel />
              {detail.refundStatus && detail.refundStatus !== "none" ? (
                <span className={styles.statusChip}>
                  {detail.refundStatus === "pending"
                    ? "Remboursement en cours"
                    : detail.refundStatus === "failed"
                      ? "Remboursement en échec"
                      : detail.refundStatus === "manual_succeeded"
                        ? "Remboursé (virement)"
                        : "Remboursé"}
                </span>
              ) : null}
              {detail.emailDeliveryWarning ? (
                <span
                  className={styles.emailFailChip}
                  title={
                    detail.emailDeliveryWarning.error
                      ? `Email non envoyé — ${detail.emailDeliveryWarning.error}`
                      : "Email non envoyé"
                  }
                >
                  ⚠ Email non envoyé
                </span>
              ) : null}
              {readOnly ? <span className={styles.readOnlyChip}>Lecture seule</span> : null}
            </div>
          ) : null}
          <h2 id={titleId} className={styles.title}>
            {detail?.reference ?? "…"}
          </h2>
        </div>
        <div className={styles.headerActions}>
          {showFullscreenToggle && onToggleFullscreen ? (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onToggleFullscreen}
              aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"}
              aria-pressed={fullscreen}
              title={fullscreen ? "Quitter le plein écran" : "Plein écran"}
            >
              {fullscreen ? (
                <IconArrowsMinimize size={18} stroke={1.7} aria-hidden />
              ) : (
                <IconArrowsMaximize size={18} stroke={1.7} aria-hidden />
              )}
            </button>
          ) : null}
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Retour">
            <span className={styles.closeGlyph} aria-hidden="true">
              ×
            </span>
            <span className={styles.closeLabel}>Retour</span>
          </button>
        </div>
      </header>

      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "summary"}
          className={tab === "summary" ? styles.tabActive : styles.tab}
          onClick={() => setTab("summary")}
        >
          Résumé
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "contacts"}
          className={tab === "contacts" ? styles.tabActive : styles.tab}
          onClick={() => setTab("contacts")}
        >
          Contacts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "manage"}
          className={tab === "manage" ? styles.tabActive : styles.tab}
          onClick={() => setTab("manage")}
        >
          Gérer
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "documents"}
          className={tab === "documents" ? styles.tabActive : styles.tab}
          onClick={() => setTab("documents")}
        >
          Documents <span className={styles.soon}>à venir</span>
        </button>
      </div>

      <div className={styles.body}>
        {loading ? <p className={styles.muted}>Chargement…</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        {!loading && detail && tab === "summary" ? (
          <div className={styles.cards}>
            <section className={styles.card}>
              <div className={styles.clientText}>
                <strong className={styles.clientName}>
                  {[detail.client.firstName, detail.client.lastName]
                    .map((part) => part?.trim())
                    .filter(Boolean)
                    .join(" ") || detail.client.label}
                </strong>
                {detail.client.companyName ? (
                  <p className={styles.clientCompany}>{detail.client.companyName}</p>
                ) : null}
                <p className={styles.clientSub}>
                  {[detail.client.email, detail.client.phone].filter(Boolean).join(" · ") ||
                    "Coordonnées non renseignées"}
                </p>
              </div>
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Espace et dates</h3>
              <div className={styles.infoRows}>
                <div className={styles.infoRow}>
                  <IconDoor size={16} stroke={1.6} className={styles.infoIcon} aria-hidden />
                  <span>
                    {detail.space.name} · {SPACE_TYPE_LABELS[detail.space.type]}
                    <span className={styles.infoMuted}> · {detail.space.buildingName}</span>
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <IconCalendar size={16} stroke={1.6} className={styles.infoIcon} aria-hidden />
                  <span>
                    {formatDateTime(detail.startAt)} → {formatDateTime(detail.endAt)}
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Réservation</h3>
              <ul className={styles.serviceList}>
                <li className={styles.serviceItem}>
                  <div className={styles.serviceRow}>
                    <span>
                      {detail.space.name}
                      <span className={styles.infoMuted}>
                        {" "}
                        · {formatAvailabilityWindow(detail.startAt, detail.endAt)}
                      </span>
                    </span>
                    <span className={styles.servicePrice}>
                      {formatCentsEur(detail.pricing.spaceHT)}
                    </span>
                  </div>
                </li>
              </ul>
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Services</h3>
              {detail.services.length === 0 ? (
                <p className={styles.muted}>Aucun service associé.</p>
              ) : (
                <ul className={styles.serviceList}>
                  {detail.services.map((service) => {
                    const answerCount = serviceAnswerCount(service);
                    return (
                      <li
                        key={`${service.serviceId}-${service.label}`}
                        className={styles.serviceItem}
                      >
                        <div className={styles.serviceRow}>
                          <span>
                            {service.label}
                            {service.qty > 1 ? ` × ${service.qty}` : null}
                          </span>
                          <span className={styles.servicePrice}>
                            {formatCentsEur(service.unitPriceHT * service.qty)}
                          </span>
                        </div>
                        {answerCount > 0 ? (
                          <details className={styles.serviceAnswers}>
                            <summary className={styles.serviceAnswersSummary}>
                              <IconChevronDown
                                size={14}
                                stroke={1.6}
                                className={styles.serviceAnswersChevron}
                                aria-hidden
                              />
                              {answerCount} réponse{answerCount > 1 ? "s" : ""}
                            </summary>
                            <dl className={styles.serviceAnswersList}>
                              {(service.customAnswers ?? []).map((answer) => (
                                <div
                                  key={`${answer.questionId}-${answer.label}`}
                                  className={styles.serviceAnswerRow}
                                >
                                  <dt>{answer.label}</dt>
                                  <dd>
                                    {formatServiceCustomAnswerValue(answer.type, answer.value)}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </details>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Montants</h3>
              <div className={styles.amountLines}>
                <div className={styles.amountLineMuted}>
                  <span>Réservation</span>
                  <span>{formatCentsEur(detail.pricing.spaceHT)}</span>
                </div>
                <div className={styles.amountLineMuted}>
                  <span>Services</span>
                  <span>{formatCentsEur(detail.pricing.servicesHT)}</span>
                </div>
                <div className={styles.amountSubDivider} />
                <div className={styles.amountLine}>
                  <span>Total HT</span>
                  <span>{formatCentsEur(detail.pricing.subtotalHT)}</span>
                </div>
                <div className={styles.amountLine}>
                  <span>TVA</span>
                  <span>{formatCentsEur(detail.pricing.totalVAT)}</span>
                </div>
                <div className={styles.amountLine}>
                  <span>Remise</span>
                  <span>{formatCentsEur(detail.pricing.discountTotal)}</span>
                </div>
              </div>
              <div className={styles.divider} />
              <div className={styles.ttcRow}>
                <span>Total TTC</span>
                <span className={styles.ttcValue}>{formatCentsEur(detail.pricing.totalTTC)}</span>
              </div>
              <div className={styles.divider} />
              <p className={settled ? styles.paymentSettled : styles.paymentOpen}>
                Payé {formatCentsEur(paidTotal)} · Reste dû {formatCentsEur(balanceDue)}
              </p>
              {detail.paymentMethod || detail.awaitingPaymentMethod ? (
                <p className={styles.paymentMethodLine}>
                  Moyen de paiement ·{" "}
                  {(detail.paymentMethod ?? detail.awaitingPaymentMethod) === "card"
                    ? "Carte"
                    : "Virement bancaire"}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}

        {!loading && detail && tab === "contacts" ? (
          <ReservationContactsPanel
            reservationId={reservationId}
            detail={detail}
            readOnly={readOnly}
          />
        ) : null}

        {!loading && detail && tab === "manage" ? (
          <ReservationManagePanel
            reservationId={reservationId}
            detail={detail}
            onChanged={() => {
              loadDetail({ silent: true });
              onReservationMutated?.();
            }}
            onOpenReservation={onOpenReservation}
          />
        ) : null}

        {!loading && detail && tab === "documents" ? (
          <div className={styles.cards}>
            <p className={styles.banner}>
              Les documents de réservation (contrats, factures PDF, etc.) seront disponibles ici
              prochainement.
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
