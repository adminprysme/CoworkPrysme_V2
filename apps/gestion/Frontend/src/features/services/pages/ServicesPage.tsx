import { useCallback, useEffect, useState } from "react";

import type { ServiceResponse } from "@coworkprysme/shared";

import { createService, fetchServices, updateService } from "../../../lib/services-api.js";
import { ServiceCard } from "../components/ServiceCard.js";
import {
  ServiceFormPanel,
  serviceFormValuesToCreateRequest,
} from "../components/ServiceFormPanel.js";
import styles from "./ServicesPage.module.css";

export function ServicesPage() {
  const [services, setServices] = useState<ServiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceResponse | undefined>();

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchServices("all");
      setServices(response.services);
    } catch {
      setError("Impossible de charger les services.");
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  async function handleSubmit(values: Parameters<typeof serviceFormValuesToCreateRequest>[0]) {
    const payload = serviceFormValuesToCreateRequest(values);
    if (editing) {
      await updateService(editing.id, payload);
    } else {
      await createService(payload);
    }
    await loadServices();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Services</h1>
          <p className={styles.subtitle}>
            Catalogue des prestations complémentaires (vitrine, facturation, post-master).
          </p>
        </div>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          Nouveau service
        </button>
      </header>

      {error ? <p className={styles.errorBanner}>{error}</p> : null}
      {loading ? <p className={styles.loadingState}>Chargement…</p> : null}

      {!loading && services.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Aucun service pour le moment. Créez le premier élément du catalogue.</p>
        </div>
      ) : null}

      <div className={styles.grid}>
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onEdit={() => {
              setEditing(service);
              setFormOpen(true);
            }}
          />
        ))}
      </div>

      <ServiceFormPanel
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
