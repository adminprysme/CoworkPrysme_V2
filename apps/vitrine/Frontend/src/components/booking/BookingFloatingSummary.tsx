"use client";

import type { BookingPriceResponse } from "@coworkprysme/shared";
import { formatCentsAsEuroString } from "@coworkprysme/shared";
import { useState } from "react";

import { formatCountdown } from "@/hooks/useBookingLock";

import styles from "./BookingFloatingSummary.module.css";

export interface BookingCartServiceLine {
  serviceId: string;
  label: string;
  qty: number;
  answerSummary?: string[];
}

interface BookingFloatingSummaryProps {
  searchSummary?: string | null;
  spaceLabel?: string | null;
  slotLabel?: string | null;
  services: BookingCartServiceLine[];
  price: BookingPriceResponse | null;
  priceLoading: boolean;
  priceError?: string | null;
  lockCountdownMs?: number | null;
  expandedByDefault?: boolean;
}

export function BookingFloatingSummary({
  searchSummary,
  spaceLabel,
  slotLabel,
  services,
  price,
  priceLoading,
  priceError,
  lockCountdownMs = null,
  expandedByDefault = false,
}: BookingFloatingSummaryProps) {
  const [mobileExpanded, setMobileExpanded] = useState(expandedByDefault);

  return (
    <aside className={styles.summaryShell} aria-label="Résumé de réservation">
      <div className={styles.summaryDesktop}>
        <SummaryContent
          searchSummary={searchSummary}
          spaceLabel={spaceLabel}
          slotLabel={slotLabel}
          services={services}
          price={price}
          priceLoading={priceLoading}
          priceError={priceError}
          lockCountdownMs={lockCountdownMs}
        />
      </div>

      <div className={styles.summaryMobile}>
        <button
          type="button"
          className={styles.mobileToggle}
          aria-expanded={mobileExpanded}
          onClick={() => setMobileExpanded((value) => !value)}
        >
          <span className={styles.mobileToggleLabel}>
            {priceLoading
              ? "Calcul…"
              : price
                ? `${formatCentsAsEuroString(price.totalTTC)} € TTC`
                : "Résumé"}
          </span>
          {lockCountdownMs != null ? (
            <span className={styles.mobileCountdown}>{formatCountdown(lockCountdownMs)}</span>
          ) : null}
        </button>
        {mobileExpanded ? (
          <div className={styles.mobilePanel}>
            <SummaryContent
              searchSummary={searchSummary}
              spaceLabel={spaceLabel}
              slotLabel={slotLabel}
              services={services}
              price={price}
              priceLoading={priceLoading}
              priceError={priceError}
              lockCountdownMs={lockCountdownMs}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function SummaryContent({
  searchSummary,
  spaceLabel,
  slotLabel,
  services,
  price,
  priceLoading,
  priceError,
  lockCountdownMs,
}: Omit<BookingFloatingSummaryProps, "expandedByDefault">) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryHeader}>
        <h2 className={styles.summaryTitle}>Votre réservation</h2>
        {lockCountdownMs != null ? (
          <p className={styles.countdown}>{formatCountdown(lockCountdownMs)}</p>
        ) : null}
      </div>

      {searchSummary ? <p className={styles.summaryLine}>{searchSummary}</p> : null}
      {spaceLabel ? <p className={styles.summaryLineStrong}>{spaceLabel}</p> : null}
      {slotLabel ? <p className={styles.summaryLine}>{slotLabel}</p> : null}

      {services.length > 0 ? (
        <ul className={styles.serviceList}>
          {services.map((service) => (
            <li key={service.serviceId} className={styles.serviceItem}>
              <span>
                {service.label} × {service.qty}
              </span>
              {service.answerSummary?.map((answer) => (
                <span key={answer} className={styles.answerLine}>
                  {answer}
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.totals}>
        {priceError ? <p className={styles.priceError}>{priceError}</p> : null}
        {price ? (
          <>
            <div className={styles.totalRow}>
              <span>Sous-total HT</span>
              <span>{formatCentsAsEuroString(price.subtotalHT)} €</span>
            </div>
            {price.discountTotal > 0 ? (
              <div className={styles.totalRow}>
                <span>Remise</span>
                <span>-{formatCentsAsEuroString(price.discountTotal)} €</span>
              </div>
            ) : null}
            <div className={[styles.totalRow, styles.totalRowStrong].join(" ")}>
              <span>Total TTC</span>
              <span>{formatCentsAsEuroString(price.totalTTC)} €</span>
            </div>
          </>
        ) : priceLoading ? (
          <p className={styles.pricePending}>Mise à jour du total…</p>
        ) : null}
      </div>
    </div>
  );
}
