import { useEffect, useId, useState } from "react";
import type { PlanningReservationDetail } from "@coworkprysme/shared";

import { fetchPlanningReservation } from "../../../lib/planning-api.js";
import { PAYMENT_STATUS_LABELS, formatCentsEur, formatDateTime } from "../planning-utils.js";
import styles from "./ReservationDetailDrawer.module.css";

type TabId = "summary" | "contacts" | "manage" | "documents";

interface ReservationDetailDrawerProps {
  reservationId: string;
  onClose: () => void;
}

const SPACE_TYPE_LABELS = {
  meeting_room: "Salle de réunion",
  private_office: "Bureau privatif",
} as const;

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

  return (
    <aside className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Réservation</p>
          <h2 id={titleId} className={styles.title}>
            {detail?.reference ?? "…"}
          </h2>
          {detail ? (
            <p className={styles.meta}>
              {PAYMENT_STATUS_LABELS[detail.paymentStatus]}
              {readOnly ? " · Lecture seule" : null}
            </p>
          ) : null}
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
          <div className={styles.sections}>
            <section>
              <h3>Client</h3>
              <dl className={styles.dl}>
                <div>
                  <dt>Nom</dt>
                  <dd>{detail.client.label}</dd>
                </div>
                {detail.client.email ? (
                  <div>
                    <dt>Email</dt>
                    <dd>{detail.client.email}</dd>
                  </div>
                ) : null}
                {detail.client.phone ? (
                  <div>
                    <dt>Téléphone</dt>
                    <dd>{detail.client.phone}</dd>
                  </div>
                ) : null}
                {detail.client.companyName ? (
                  <div>
                    <dt>Société</dt>
                    <dd>{detail.client.companyName}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section>
              <h3>Espace & dates</h3>
              <dl className={styles.dl}>
                <div>
                  <dt>Espace</dt>
                  <dd>
                    {detail.space.name} ({SPACE_TYPE_LABELS[detail.space.type]})
                  </dd>
                </div>
                <div>
                  <dt>Bâtiment</dt>
                  <dd>{detail.space.buildingName}</dd>
                </div>
                <div>
                  <dt>Début</dt>
                  <dd>{formatDateTime(detail.startAt)}</dd>
                </div>
                <div>
                  <dt>Fin</dt>
                  <dd>{formatDateTime(detail.endAt)}</dd>
                </div>
                <div>
                  <dt>Statut réservation</dt>
                  <dd>{detail.status}</dd>
                </div>
                <div>
                  <dt>Canal</dt>
                  <dd>{detail.createdChannel}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h3>Services</h3>
              {detail.services.length === 0 ? (
                <p className={styles.muted}>Aucun service associé.</p>
              ) : (
                <ul className={styles.list}>
                  {detail.services.map((service) => (
                    <li key={`${service.serviceId}-${service.label}`}>
                      {service.label} × {service.qty} — {formatCentsEur(service.unitPriceHT)} HT
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3>Montants</h3>
              <dl className={styles.dl}>
                <div>
                  <dt>Total HT</dt>
                  <dd>{formatCentsEur(detail.pricing.subtotalHT)}</dd>
                </div>
                <div>
                  <dt>TVA</dt>
                  <dd>{formatCentsEur(detail.pricing.totalVAT)}</dd>
                </div>
                <div>
                  <dt>Remise</dt>
                  <dd>{formatCentsEur(detail.pricing.discountTotal)}</dd>
                </div>
                <div>
                  <dt>Total TTC</dt>
                  <dd className={styles.emphasis}>{formatCentsEur(detail.pricing.totalTTC)}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h3>Paiement</h3>
              <dl className={styles.dl}>
                <div>
                  <dt>Statut</dt>
                  <dd>{PAYMENT_STATUS_LABELS[detail.paymentStatus]}</dd>
                </div>
                {detail.invoice ? (
                  <>
                    <div>
                      <dt>Facture</dt>
                      <dd>{detail.invoice.reference}</dd>
                    </div>
                    <div>
                      <dt>Payé</dt>
                      <dd>{formatCentsEur(detail.invoice.paidTotal)}</dd>
                    </div>
                    <div>
                      <dt>Reste dû</dt>
                      <dd>{formatCentsEur(detail.invoice.balanceDue)}</dd>
                    </div>
                  </>
                ) : (
                  <div>
                    <dt>Facture</dt>
                    <dd>Aucune</dd>
                  </div>
                )}
                {detail.awaitingPaymentMethod ? (
                  <div>
                    <dt>Mode en attente</dt>
                    <dd>{detail.awaitingPaymentMethod}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          </div>
        ) : null}

        {!loading && detail && tab === "contacts" ? (
          <div className={styles.sections}>
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
