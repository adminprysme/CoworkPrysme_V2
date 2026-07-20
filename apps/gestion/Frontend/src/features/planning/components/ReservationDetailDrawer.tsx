import { useEffect, useId, useState } from "react";
import { IconCalendar, IconDoor } from "@tabler/icons-react";
import type { PlanningReservationDetail } from "@coworkprysme/shared";

import { fetchPlanningReservation } from "../../../lib/planning-api.js";
import {
  ClientAvatar,
  PaymentStatusBadge,
  RESERVATION_STATUS_LABELS,
  SPACE_TYPE_LABELS,
} from "../planning-ui.js";
import { formatCentsEur, formatDateTime } from "../planning-utils.js";
import styles from "./ReservationDetailDrawer.module.css";

type TabId = "summary" | "contacts" | "manage" | "documents";

interface ReservationDetailDrawerProps {
  reservationId: string;
  onClose: () => void;
}

export function ReservationDetailDrawer({ reservationId, onClose }: ReservationDetailDrawerProps) {
  const titleId = useId();
  const [tab, setTab] = useState<TabId>("summary");
  const [detail, setDetail] = useState<PlanningReservationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTab("summary");
    void fetchPlanningReservation(reservationId)
      .then((payload) => {
        if (!cancelled) {
          setDetail(payload);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur de chargement");
          setDetail(null);
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
  }, [reservationId]);

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
          {detail ? (
            <div className={styles.headerBadges}>
              <span className={styles.statusChip}>
                {RESERVATION_STATUS_LABELS[detail.status] ?? detail.status}
              </span>
              <PaymentStatusBadge status={detail.paymentStatus} />
              {readOnly ? <span className={styles.readOnlyChip}>Lecture seule</span> : null}
            </div>
          ) : (
            <p className={styles.kicker}>Réservation</p>
          )}
          <h2 id={titleId} className={styles.title}>
            {detail?.reference ?? "…"}
          </h2>
        </div>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
          ×
        </button>
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
          aria-selected={false}
          className={styles.tabDisabled}
          disabled
          title="À venir"
        >
          Gérer <span className={styles.soon}>à venir</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          className={styles.tabDisabled}
          disabled
          title="À venir"
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
              <div className={styles.clientRow}>
                <ClientAvatar label={detail.client.label} size={40} />
                <div className={styles.clientText}>
                  <strong className={styles.clientName}>{detail.client.label}</strong>
                  <p className={styles.clientSub}>
                    {[detail.client.email, detail.client.phone].filter(Boolean).join(" · ") ||
                      "Coordonnées non renseignées"}
                  </p>
                </div>
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
              <h3 className={styles.cardTitle}>Services</h3>
              {detail.services.length === 0 ? (
                <p className={styles.muted}>Aucun service associé.</p>
              ) : (
                <ul className={styles.serviceList}>
                  {detail.services.map((service) => (
                    <li key={`${service.serviceId}-${service.label}`} className={styles.serviceRow}>
                      <span>
                        {service.label}
                        {service.qty > 1 ? ` × ${service.qty}` : null}
                      </span>
                      <span className={styles.servicePrice}>
                        {formatCentsEur(service.unitPriceHT * service.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Montants</h3>
              <div className={styles.amountLines}>
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
            </section>
          </div>
        ) : null}

        {!loading && detail && tab === "contacts" ? (
          <div className={styles.cards}>
            {readOnly ? (
              <p className={styles.banner}>Réservation terminée ou annulée — lecture pure.</p>
            ) : null}
            {detail.contacts.length === 0 ? (
              <p className={styles.muted}>Aucun compte client lié.</p>
            ) : (
              <ul className={styles.contactList}>
                {detail.contacts.map((contact) => (
                  <li key={contact.id} className={styles.contactCard}>
                    <strong>{contact.email}</strong>
                    <span>
                      {contact.status}
                      {contact.emailVerified ? " · email vérifié" : " · email non vérifié"}
                    </span>
                    <span className={styles.muted}>
                      Lié via {contact.linkedVia === "reservation" ? "réservation" : "cardex"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
