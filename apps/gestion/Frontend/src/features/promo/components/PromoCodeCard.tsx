import type { DiscountCodeResponse } from "@coworkprysme/shared";

import { DISPLAY_STATUS_LABELS } from "../utils/validation.js";
import styles from "./PromoCodeCard.module.css";

interface PromoCodeCardProps {
  code: DiscountCodeResponse;
  onEdit: () => void;
}

const STATUS_CLASS = {
  active: styles.badgeActive ?? "",
  expired: styles.badgeExpired ?? "",
  exhausted: styles.badgeExhausted ?? "",
  disabled: styles.badgeDisabled ?? "",
} satisfies Record<DiscountCodeResponse["displayStatus"], string>;

function statusClass(displayStatus: DiscountCodeResponse["displayStatus"]): string {
  return STATUS_CLASS[displayStatus];
}

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
  const expiresLabel = new Date(code.expiresAt).toLocaleDateString("fr-FR");

  return (
    <button type="button" className={styles.card} onClick={onEdit}>
      <div className={styles.header}>
        <h3 className={styles.code}>{code.code}</h3>
        <span className={[styles.badge, statusClass(code.displayStatus)].join(" ")}>
          {DISPLAY_STATUS_LABELS[code.displayStatus]}
        </span>
      </div>
      <p className={styles.discount}>{formatDiscount(code)}</p>
      <p className={styles.meta}>
        Périmètre :{" "}
        {code.perimeter.appliesTo === "order"
          ? "Toute la commande"
          : `${code.perimeter.serviceKeys?.length ?? 0} service(s)`}
      </p>
      <p className={styles.meta}>
        Expire le {expiresLabel}
        {code.maxUses != null ? ` · ${code.usedCount}/${code.maxUses} utilisations` : " · Illimité"}
      </p>
      {code.stackable ? <span className={styles.stackable}>Cumulable</span> : null}
    </button>
  );
}
