import { useCallback, useEffect, useState } from "react";

import type { DiscountCodeResponse, ServicePromoEligibility } from "@coworkprysme/shared";

import {
  createDiscountCode,
  fetchDiscountCodeServiceOptions,
  fetchDiscountCodes,
  updateDiscountCode,
} from "../../../lib/discount-codes-api.js";
import { PromoCodeCard } from "../components/PromoCodeCard.js";
import {
  PromoCodeFormPanel,
  promoCodeFormValuesToCreateRequest,
} from "../components/PromoCodeFormPanel.js";
import styles from "./PromoCodesPage.module.css";

export function PromoCodesPage() {
  const [codes, setCodes] = useState<DiscountCodeResponse[]>([]);
  const [services, setServices] = useState<ServicePromoEligibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCodeResponse | undefined>();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [codesResponse, serviceOptions] = await Promise.all([
        fetchDiscountCodes(),
        fetchDiscountCodeServiceOptions(),
      ]);
      setCodes(codesResponse.discountCodes);
      setServices(serviceOptions.services);
    } catch {
      setError("Impossible de charger les codes promo.");
      setCodes([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSubmit(values: Parameters<typeof promoCodeFormValuesToCreateRequest>[0]) {
    const payload = promoCodeFormValuesToCreateRequest(values);
    if (editing) {
      await updateDiscountCode(editing.id, payload);
    } else {
      await createDiscountCode(payload);
    }
    await loadData();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Codes promo</h1>
        </div>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          Nouveau code
        </button>
      </header>

      {error ? <p className={styles.errorBanner}>{error}</p> : null}
      {loading ? <p className={styles.loadingState}>Chargement…</p> : null}

      {!loading && codes.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Aucun code promo. Créez-en un pour alimenter le tunnel vitrine.</p>
        </div>
      ) : null}

      <div className={styles.grid}>
        {codes.map((code) => (
          <PromoCodeCard
            key={code.id}
            code={code}
            onEdit={() => {
              setEditing(code);
              setFormOpen(true);
            }}
          />
        ))}
      </div>

      <PromoCodeFormPanel
        open={formOpen}
        editing={editing}
        services={services}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
