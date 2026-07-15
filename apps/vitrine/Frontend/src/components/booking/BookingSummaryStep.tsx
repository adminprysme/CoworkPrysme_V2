"use client";

import type { BookingPriceResponse } from "@coworkprysme/shared";
import { formatCentsAsEuroString } from "@coworkprysme/shared";
import Link from "next/link";

import { canProceedToBookingPayment } from "./booking-summary-validation";
import styles from "./BookingTunnelStep.module.css";

export type BookingSummaryFormState = {
  cgvAccepted: boolean;
  withdrawalAcknowledged: boolean;
};

interface BookingSummaryStepProps {
  price: BookingPriceResponse;
  spaceLabel: string;
  slotLabel: string;
  value: BookingSummaryFormState;
  onChange: (value: BookingSummaryFormState) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function BookingSummaryStep({
  price,
  spaceLabel,
  slotLabel,
  value,
  onChange,
  onBack,
  onContinue,
}: BookingSummaryStepProps) {
  const canContinue = canProceedToBookingPayment(value);

  return (
    <section className={styles.step}>
      <div className={styles.stepHeader}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← Retour
        </button>
        <div>
          <h2 className={styles.title}>Récapitulatif</h2>
          <p className={styles.lead}>Vérifiez votre réservation avant le règlement.</p>
        </div>
      </div>

      <div className={styles.recapBlock}>
        <p className={styles.lineRow}>
          <span>{spaceLabel}</span>
        </p>
        <p className={styles.lineRow}>
          <span>{slotLabel}</span>
        </p>

        <div>
          {price.lines.map((line) => (
            <div
              key={`${line.kind}-${line.label}-${line.refId ?? "space"}`}
              className={styles.lineRow}
            >
              <span>
                {line.label}
                {line.qty > 1 ? ` × ${line.qty}` : ""}
                {line.discount > 0 ? ` (−${formatCentsAsEuroString(line.discount)} €)` : ""}
              </span>
              <span>{formatCentsAsEuroString(line.totalTTC)} €</span>
            </div>
          ))}
        </div>

        <div className={[styles.lineRow, styles.lineRowStrong].join(" ")}>
          <span>Total TTC</span>
          <span>{formatCentsAsEuroString(price.totalTTC)} €</span>
        </div>

        <ul className={styles.vatList}>
          {price.vatBreakdown.map((line) => (
            <li key={line.rate}>
              TVA {line.rate} % — base {formatCentsAsEuroString(line.baseHT)} € :{" "}
              {formatCentsAsEuroString(line.vat)} €
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.form}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={value.cgvAccepted}
            onChange={(event) => onChange({ ...value, cgvAccepted: event.target.checked })}
          />
          <span>
            J&apos;accepte les{" "}
            <Link href="/cgv" className={styles.link}>
              Conditions Générales de Vente
            </Link>
            .
          </span>
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={value.withdrawalAcknowledged}
            onChange={(event) =>
              onChange({ ...value, withdrawalAcknowledged: event.target.checked })
            }
          />
          <span>
            Conformément aux articles L.221-18 et suivants du Code de la consommation, je reconnais
            disposer d&apos;un délai de 14 jours pour exercer mon droit de rétractation à compter de
            la confirmation de réservation. Ce droit est réservé aux consommateurs ; les clients
            professionnels n&apos;en bénéficient pas (article 6 des CGV).
          </span>
        </label>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!canContinue}
            onClick={onContinue}
          >
            Continuer vers le paiement
          </button>
        </div>
      </div>
    </section>
  );
}
