import styles from "../BillingPages.module.css";

export const BILLING_PAGE_SIZES = [25, 50, 100] as const;
export type BillingPageSize = (typeof BILLING_PAGE_SIZES)[number];

type BillingTablePaginationProps = {
  page: number;
  pageSize: BillingPageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: BillingPageSize) => void;
  disabled?: boolean;
  itemLabel?: string;
};

export function BillingTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  itemLabel = "éléments",
}: BillingTablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className={styles.pagination} role="navigation" aria-label="Pagination">
      <label className={styles.paginationSize}>
        <span className={styles.paginationSizeLabel}>Afficher</span>
        <select
          className={`${styles.select} ${styles.paginationSelect}`}
          value={pageSize}
          disabled={disabled}
          aria-label="Lignes par page"
          onChange={(event) => {
            onPageSizeChange(Number(event.target.value) as BillingPageSize);
          }}
        >
          {BILLING_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <p className={styles.paginationRange}>
        {total === 0 ? `Aucun ${itemLabel}` : `${from}–${to} sur ${total} ${itemLabel}`}
      </p>

      <div className={styles.paginationButtons}>
        <button
          type="button"
          className={styles.paginationButton}
          disabled={disabled || safePage <= 1}
          aria-label="Page précédente"
          onClick={() => onPageChange(safePage - 1)}
        >
          Précédent
        </button>
        <span className={styles.paginationPage}>
          Page {safePage} / {pageCount}
        </span>
        <button
          type="button"
          className={styles.paginationButton}
          disabled={disabled || safePage >= pageCount}
          aria-label="Page suivante"
          onClick={() => onPageChange(safePage + 1)}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
