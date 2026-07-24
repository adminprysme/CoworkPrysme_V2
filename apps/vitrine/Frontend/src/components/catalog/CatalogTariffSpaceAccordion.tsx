import type { CatalogTariffSpaceGroup } from "@coworkprysme/shared";
import { SPACE_DURATION_CLASSES, formatCentsAsEuroString } from "@coworkprysme/shared";

import styles from "./catalog.module.css";

const DURATION_ORDER = Object.fromEntries(
  SPACE_DURATION_CLASSES.map((durationClass, index) => [durationClass, index]),
) as Record<(typeof SPACE_DURATION_CLASSES)[number], number>;

function sortTariffLines<T extends { durationClass: (typeof SPACE_DURATION_CLASSES)[number] }>(
  lines: T[],
): T[] {
  return [...lines].sort(
    (left, right) => DURATION_ORDER[left.durationClass] - DURATION_ORDER[right.durationClass],
  );
}

function lowestPriceCents(lines: CatalogTariffSpaceGroup["lines"]): number | null {
  if (lines.length === 0) {
    return null;
  }
  return Math.min(...lines.map((line) => line.priceHTCents));
}

interface CatalogTariffSpaceAccordionProps {
  group: CatalogTariffSpaceGroup;
  defaultOpen?: boolean;
}

export function CatalogTariffSpaceAccordion({
  group,
  defaultOpen = false,
}: CatalogTariffSpaceAccordionProps) {
  const lines = sortTariffLines(group.lines);
  const bestPrice = lowestPriceCents(lines);
  const panelId = `tariffs-space-panel-${group.spaceId}`;

  return (
    <details className={styles.tariffsSpaceCard} open={defaultOpen || undefined}>
      <summary className={styles.tariffsSpaceSummary} aria-controls={panelId}>
        <span className={styles.tariffsSpaceSummaryMain}>
          <span className={styles.tariffsSpaceChevron} aria-hidden="true" />
          <span className={styles.tariffsSpaceTitle}>{group.spaceName}</span>
        </span>
        <span className={styles.tariffsSpaceCapacity}>{group.capacity} pers.</span>
      </summary>

      <div id={panelId} className={styles.tariffsSpaceBody}>
        {lines.length === 0 ? (
          <p className={styles.tariffsSpaceEmpty}>Tarif sur demande</p>
        ) : (
          <ul
            className={styles.tariffsPriceGrid}
            data-line-count={lines.length}
            style={{ "--tariff-line-count": lines.length } as React.CSSProperties}
          >
            {lines.map((line) => {
              const isBestPrice = bestPrice !== null && line.priceHTCents === bestPrice;
              return (
                <li
                  key={line.durationClass}
                  className={`${styles.tariffsPriceCell}${isBestPrice ? ` ${styles.tariffsPriceCellHighlight}` : ""}`}
                >
                  <span className={styles.tariffsDuration}>{line.label}</span>
                  <span className={styles.tariffsAmount}>
                    {isBestPrice ? <span className={styles.tariffsFromLabel}>dès </span> : null}
                    {formatCentsAsEuroString(line.priceHTCents)}
                    <span className={styles.tariffsAmountSuffix}> € HT</span>
                  </span>
                  <span className={styles.tariffsVat}>{line.vatRate} % TVA</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
