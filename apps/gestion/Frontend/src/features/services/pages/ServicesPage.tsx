import { useCallback, useEffect, useState } from "react";

import type { ServiceResponse } from "@coworkprysme/shared";
import { getServiceEditMode } from "@coworkprysme/shared";

import { useAuth } from "../../../app/AuthProvider.js";
import {
  createService,
  deleteService,
  deleteServicePhoto,
  fetchServices,
  updateService,
  uploadServicePhoto,
} from "../../../lib/services-api.js";
import { ServiceCard } from "../components/ServiceCard.js";
import { ServiceFormPanel } from "../components/ServiceFormPanel.js";
import {
  serviceFormValuesToCreateRequest,
  serviceFormValuesToUpdateRequest,
  type ServiceFormValues,
} from "../utils/validation.js";
import styles from "./ServicesPage.module.css";

export function ServicesPage() {
  const { user } = useAuth();
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

  async function handleSubmit(
    values: ServiceFormValues,
    currentEditing: ServiceResponse | undefined,
    options: {
      pendingPhoto: File | null;
      removePhoto: boolean;
      onPhotoUploaded: (service: ServiceResponse) => void;
    },
  ) {
    if (!user) {
      return;
    }

    if (currentEditing) {
      const editMode = getServiceEditMode(
        {
          role: user.profile.role,
          scopeBuildingIds: user.profile.scope.buildingIds,
        },
        {
          id: currentEditing.id,
          isGlobal: currentEditing.isGlobal,
          buildingIds: currentEditing.buildingIds,
        },
      );
      const payload = serviceFormValuesToUpdateRequest(values, editMode);
      let updated = await updateService(currentEditing.id, payload);

      if (options.removePhoto && currentEditing.photo && editMode === "all") {
        updated = await deleteServicePhoto(currentEditing.id);
      } else if (options.pendingPhoto && editMode === "all") {
        updated = await uploadServicePhoto(currentEditing.id, options.pendingPhoto);
      }

      options.onPhotoUploaded(updated);
    } else {
      const created = await createService(serviceFormValuesToCreateRequest(values));
      if (options.pendingPhoto) {
        await uploadServicePhoto(created.id, options.pendingPhoto);
      }
    }

    await loadServices();
  }

  async function handleDelete(service: ServiceResponse) {
    if (!window.confirm(`Supprimer le service « ${service.label} » ?`)) {
      return;
    }
    await deleteService(service.id);
    await loadServices();
  }

  const isAdmin = user?.profile.role === "admin";

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
          <div key={service.id} className={styles.cardWrap}>
            <ServiceCard
              service={service}
              onEdit={() => {
                setEditing(service);
                setFormOpen(true);
              }}
            />
            {isAdmin ? (
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => void handleDelete(service)}
              >
                Supprimer
              </button>
            ) : null}
          </div>
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
