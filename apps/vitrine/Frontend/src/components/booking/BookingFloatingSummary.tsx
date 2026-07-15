"use client";

import type { BookingPriceResponse } from "@coworkprysme/shared";
import { formatCentsAsEuroString } from "@coworkprysme/shared";
import { useEffect, useState } from "react";

import { formatCountdown } from "@/hooks/useBookingLock";

import styles from "./BookingFloatingSummary.module.css";

export interface BookingCartServiceLine {
  serviceId: string;
  label: string;
  qty: number;
  lineTotalTTC?: number;
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
  showPromoField?: boolean;
  discountCode?: string;
  onDiscountCodeChange?: (code: string) => void;
  promoMessage?: string | null;
  promoError?: string | null;
  onReleaseLock?: () => void;
  releaseLoading?: boolean;
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
  showPromoField = false,
  discountCode = "",
  onDiscountCodeChange,
  promoMessage = null,
  promoError = null,
  onReleaseLock,
  releaseLoading = false,
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
          showPromoField={showPromoField}
          discountCode={discountCode}
          onDiscountCodeChange={onDiscountCodeChange}
          promoMessage={promoMessage}
          promoError={promoError}
          onReleaseLock={onReleaseLock}
          releaseLoading={releaseLoading}
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
            <span className={styles.mobileCountdown}>
              <ClockIcon />
              {formatCountdown(lockCountdownMs)}
            </span>
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
              showPromoField={showPromoField}
              discountCode={discountCode}
              onDiscountCodeChange={onDiscountCodeChange}
              promoMessage={promoMessage}
              promoError={promoError}
              onReleaseLock={onReleaseLock}
              releaseLoading={releaseLoading}
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
  showPromoField,
  discountCode,
  onDiscountCodeChange,
  promoMessage,
  promoError,
  onReleaseLock,
  releaseLoading,
}: Omit<BookingFloatingSummaryProps, "expandedByDefault">) {
  const [promoDraft, setPromoDraft] = useState(discountCode ?? "");
  const hasAppliedDiscount = Boolean(price?.discount && price.discountTotal > 0);

  useEffect(() => {
    setPromoDraft(discountCode ?? "");
  }, [discountCode]);

  function applyPromoCode() {
    onDiscountCodeChange?.(promoDraft.trim().toUpperCase());
  }

  function removePromoCode() {
    setPromoDraft("");
    onDiscountCodeChange?.("");
  }

  const cartServices = services.filter((service) => service.qty > 0);

  return (
    <div className={styles.summaryCard}>
      <h2 className={styles.summaryTitle}>Votre réservation</h2>

      <div className={styles.summaryDetails}>
        {searchSummary ? <p className={styles.summaryLine}>{searchSummary}</p> : null}
        {spaceLabel ? <p className={styles.summaryLineStrong}>{spaceLabel}</p> : null}
        {slotLabel ? <p className={styles.summaryLine}>{slotLabel}</p> : null}
      </div>

      {cartServices.length > 0 ? (
        <div className={styles.cartSection}>
          <p className={styles.sectionLabel}>Services ajoutés</p>
          <ul className={styles.serviceList}>
            {cartServices.map((service) => (
              <li key={service.serviceId} className={styles.serviceItem}>
                <div className={styles.serviceItemRow}>
                  <span className={styles.serviceItemName}>
                    {service.label} × {service.qty}
                  </span>
                  {service.lineTotalTTC != null ? (
                    <span className={styles.serviceItemAmount}>
                      {formatCentsAsEuroString(service.lineTotalTTC)} €
                    </span>
                  ) : null}
                </div>
                {service.answerSummary?.map((answer) => (
                  <span key={answer} className={styles.answerLine}>
                    {answer}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.totals}>
        {priceError ? <p className={styles.priceError}>{priceError}</p> : null}
        {price ? (
          <>
            <div className={styles.totalRow}>
              <span>Sous-total HT</span>
              <span>{formatCentsAsEuroString(price.subtotalHT)} €</span>
            </div>

            {showPromoField && onDiscountCodeChange ? (
              <div className={styles.promoSection}>
                {hasAppliedDiscount ? (
                  <div className={styles.appliedPromoRow}>
                    <span className={styles.appliedPromoLabel}>
                      Remise {price.discount?.code} : -
                      {formatCentsAsEuroString(price.discountTotal)} €
                    </span>
                    <button
                      type="button"
                      className={styles.promoRemoveButton}
                      onClick={removePromoCode}
                    >
                      Retirer
                    </button>
                  </div>
                ) : (
                  <div className={styles.promoForm}>
                    <label className={styles.promoField}>
                      <span className={styles.promoFieldLabel}>Code promo</span>
                      <div className={styles.promoInputRow}>
                        <input
                          className={styles.promoInput}
                          type="text"
                          value={promoDraft}
                          placeholder="Ex. WELCOME20"
                          onChange={(event) => setPromoDraft(event.target.value.toUpperCase())}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              applyPromoCode();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.promoApplyButton}
                          disabled={!promoDraft.trim()}
                          onClick={applyPromoCode}
                        >
                          Appliquer
                        </button>
                      </div>
                    </label>
                    {promoMessage ? <p className={styles.promoInfo}>{promoMessage}</p> : null}
                    {promoError ? <p className={styles.promoError}>{promoError}</p> : null}
                  </div>
                )}
              </div>
            ) : null}

            {hasAppliedDiscount && !showPromoField ? (
              <div className={styles.totalRow}>
                <span>Remise {price.discount?.code}</span>
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

      {lockCountdownMs != null ? (
        <div className={styles.countdownBanner} role="status" aria-live="polite">
          <ClockIcon />
          <div className={styles.countdownCopy}>
            <span className={styles.countdownLabel}>Temps restant</span>
            <span className={styles.countdownValue}>{formatCountdown(lockCountdownMs)}</span>
          </div>
        </div>
      ) : null}

      {onReleaseLock ? (
        <button
          type="button"
          className={styles.releaseLockButton}
          disabled={releaseLoading}
          onClick={onReleaseLock}
        >
          {releaseLoading ? "Libération…" : "Libérer le créneau"}
        </button>
      ) : null}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className={styles.clockIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7v5l3 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
