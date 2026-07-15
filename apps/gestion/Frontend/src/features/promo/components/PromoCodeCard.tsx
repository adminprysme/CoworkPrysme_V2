import type { DiscountCodeResponse } from "@coworkprysme/shared";

import { DISPLAY_STATUS_LABELS } from "../utils/validation.js";
import styles from "./PromoCodeCard.module.css";

interface PromoCodeCardProps {
  code: DiscountCodeResponse;
  onEdit: () => void;
}

const STATUS_CLASS = {
  active: styles.statusActive ?? "",
  scheduled: styles.statusScheduled ?? "",
  expired: styles.statusExpired ?? "",
  exhausted: styles.statusExpired ?? "",
  disabled: styles.statusDisabled ?? "",
} satisfies Record<DiscountCodeResponse["displayStatus"], string>;

const DISCOUNT_TYPE_LABELS: Record<DiscountCodeResponse["discountType"], string> = {
  percentage: "Pourcentage",
  fixed_amount: "Montant fixe",
  buy_one_get_one: "1 acheté = 1 offert",
};

function formatDiscount(code: DiscountCodeResponse): string {
  if (code.discountType === "percentage") {
    return `${code.valuePercent ?? code.value} %`;
  }
  if (code.discountType === "fixed_amount") {
    return `${code.valueEuros?.toFixed(2) ?? "0.00"} €`;
  }
  return "1 acheté = 1 offert";
}

export function PromoCodeCard({ code, onEdit }: PromoCodeCardProps) {
  const startsLabel = code.startsAt ? new Date(code.startsAt).toLocaleDateString("fr-FR") : null;
  const expiresLabel = new Date(code.expiresAt).toLocaleDateString("fr-FR");
  const usageLabel =
    code.maxUses != null
      ? `${code.usedCount}/${code.maxUses} utilisations`
      : "Utilisations illimitées";

  const dateLine = startsLabel
    ? `Début le ${startsLabel} · Expire le ${expiresLabel}`
    : `Expire le ${expiresLabel}`;

  const perimeterTag =
    code.perimeter.appliesTo === "order"
      ? "Toute la commande"
      : `${code.perimeter.serviceKeys?.length ?? 0} service${(code.perimeter.serviceKeys?.length ?? 0) > 1 ? "s" : ""}`;

  return (
    <article className={styles.cardShell}>
      <button type="button" className={styles.card} onClick={onEdit}>
        <div className={styles.body}>
          <div className={styles.header}>
            <h3 className={styles.title}>{code.code}</h3>
            <span className={[styles.statusBadge, STATUS_CLASS[code.displayStatus]].join(" ")}>
              {DISPLAY_STATUS_LABELS[code.displayStatus]}
            </span>
          </div>

          <p className={styles.subtitle}>{DISCOUNT_TYPE_LABELS[code.discountType]}</p>

          <div className={styles.discountBlock}>
            <div className={styles.discountPrimary}>
              <span className={styles.discountLabel}>Remise</span>
              <span className={styles.discountValue}>{formatDiscount(code)}</span>
            </div>
            <p className={styles.discountSecondary}>
              {dateLine} · {usageLabel}
            </p>
          </div>

          <div className={styles.tags}>
            <span className={styles.tag}>{perimeterTag}</span>
            {code.stackable ? <span className={styles.tag}>Cumulable</span> : null}
          </div>
        </div>
      </button>
    </article>
  );
}
