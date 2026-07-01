import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createBuilding, fetchBuildings } from "../../../lib/buildings-api.js";
import {
  buildingResponseToBuilding,
  formValuesToCreateRequest,
} from "../../../lib/buildings-mappers.js";
import { BuildingCard } from "../components/BuildingCard.js";
import { BuildingFormPanel } from "../components/BuildingFormPanel.js";
import { BuildingsMap } from "../components/BuildingsMap.js";
import type { Building, BuildingFormValues } from "../types.js";
import styles from "./BuildingsPage.module.css";

export function BuildingsPage() {
  const navigate = useNavigate();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const loadBuildings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBuildings();
      setBuildings(response.buildings.map(buildingResponseToBuilding));
    } catch {
      setError("Impossible de charger les bâtiments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBuildings();
  }, [loadBuildings]);

  function openBuilding(buildingId: string) {
    void navigate(`/spaces/${buildingId}`);
  }

  async function handleCreate(values: BuildingFormValues) {
    const created = await createBuilding(formValuesToCreateRequest(values));
    await loadBuildings();
    setSelectedId(created.id);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Bâtiments &amp; Espaces</h1>
          <p className={styles.subtitle}>Cartographie et gestion des bâtiments</p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setFormOpen(true)}>
          <span aria-hidden="true">＋</span> Nouveau bâtiment
        </button>
      </header>

      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      <div className={styles.layout}>
        <section className={styles.mapPanel} aria-label="Carte des bâtiments">
          <div className={styles.mapHeader}>Carte des bâtiments</div>
          {loading ? (
            <p className={styles.loadingState}>Chargement de la carte…</p>
          ) : (
            <BuildingsMap
              buildings={buildings}
              selectedId={selectedId}
              onSelect={(buildingId) => {
                setSelectedId(buildingId);
                openBuilding(buildingId);
              }}
            />
          )}
        </section>

        <section className={styles.listPanel} aria-label="Liste des bâtiments">
          <div className={styles.listHeader}>
            <h2 className={styles.listTitle}>Bâtiments</h2>
            <span className={styles.listCount}>{buildings.length}</span>
          </div>

          <div className={styles.listBody}>
            {loading ? (
              <p className={styles.loadingState}>Chargement…</p>
            ) : buildings.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Aucun bâtiment pour le moment.</p>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => setFormOpen(true)}
                >
                  ＋ Créer un bâtiment
                </button>
              </div>
            ) : (
              buildings.map((building) => (
                <BuildingCard
                  key={building.id}
                  building={building}
                  onOpen={() => openBuilding(building.id)}
                />
              ))
            )}
          </div>
        </section>
      </div>

      <BuildingFormPanel
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
