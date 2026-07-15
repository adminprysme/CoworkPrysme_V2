"use client";

import type { BookingConfirmResponse } from "@coworkprysme/shared";

import styles from "./BookingTunnelStep.module.css";

interface BookingConfirmedStepProps {
  result: BookingConfirmResponse;
  spaceLabel: string;
  slotLabel: string;
}

export function BookingConfirmedStep({ result, spaceLabel, slotLabel }: BookingConfirmedStepProps) {
  return (
    <section className={styles.step}>
      <div className={styles.confirmedCard}>
        <h2 className={styles.title}>Réservation confirmée</h2>
        <p className={styles.lead}>
          Merci — votre réservation <strong>{result.reservationReference}</strong> est enregistrée.
        </p>
        <p className={styles.lineRow}>
          <span>{spaceLabel}</span>
        </p>
        <p className={styles.lineRow}>
          <span>{slotLabel}</span>
        </p>
        <p className={styles.lineRow}>
          <span>Facture proforma</span>
          <span>{result.invoiceReference}</span>
        </p>
        {result.cardPaymentStubMessage ? (
          <p className={styles.notice}>{result.cardPaymentStubMessage}</p>
        ) : null}
        <p className={styles.lead}>
          Un email de confirmation vous a été envoyé avec le détail et le plan d&apos;accès.
        </p>
      </div>
    </section>
  );
}
