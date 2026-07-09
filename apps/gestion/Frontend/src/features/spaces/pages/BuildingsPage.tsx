import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createBuilding, fetchBuildings } from "../../../lib/buildings-api.js";
import {
  buildingResponseToBuilding,
  formValuesToCreateRequest,
} from "../../../lib/buildings-mappers.js";
import { persistBuildingPhotos } from "../../../lib/buildings-photos.js";
import { fetchSpacesByBuilding } from "../../../lib/spaces-api.js";
import { BuildingCard } from "../components/BuildingCard.js";
import { BuildingFormPanel } from "../components/BuildingFormPanel.js";
import { BuildingsMap } from "../components/BuildingsMap.js";
import {
  SpacesPortfolioStats,
  type SpacesPortfolioStatsData,
} from "../components/SpacesPortfolioStats.js";
import type { Building, BuildingFormValues } from "../types.js";
import styles from "./BuildingsPage.module.css";

const EMPTY_STATS: SpacesPortfolioStatsData = {
  buildingCount: 0,
  totalSpaces: 0,
  meetingRooms: 0,
  privateOffices: 0,
};

export function BuildingsPage() {
  const navigate = useNavigate();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [stats, setStats] = useState<SpacesPortfolioStatsData>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const loadBuildings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBuildings();
      const results = await Promise.all(
        response.buildings.map(async (building) => {
          try {
            const { spaces } = await fetchSpacesByBuilding(building.id);
            const activeSpaces = spaces.filter((space) => space.status !== "archived");
            return {
              building: buildingResponseToBuilding(building, activeSpaces.length),
              spaces: activeSpaces,
            };
          } catch {
            return {
              building: buildingResponseToBuilding(building, 0),
              spaces: [],
            };
          }
        }),
      );

      const nextStats = results.reduce<SpacesPortfolioStatsData>(
        (acc, { spaces }) => {
          acc.totalSpaces += spaces.length;
          for (const space of spaces) {
            if (space.type === "meeting_room") {
              acc.meetingRooms += 1;
            } else if (space.type === "private_office") {
              acc.privateOffices += 1;
            }
          }
          return acc;
        },
        { ...EMPTY_STATS, buildingCount: results.length },
      );

      setBuildings(results.map(({ building }) => building));
      setStats(nextStats);
    } catch {
      setError("Impossible de charger les bâtiments.");
      setBuildings([]);
      setStats(EMPTY_STATS);
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
    if (values.photos.length > 0) {
      await persistBuildingPhotos(created.id, values.photos);
    }
    await loadBuildings();
    setSelectedId(created.id);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerIntro}>
          <h1>Bâtiments &amp; Espaces</h1>
          <p className={styles.subtitle}>
            Vue d&apos;ensemble du parc, cartographie et accès rapide à chaque bâtiment.
          </p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setFormOpen(true)}>
          <span aria-hidden="true">＋</span> Nouveau bâtiment
        </button>
      </header>

      <SpacesPortfolioStats stats={stats} loading={loading} />

      {error ? <p className={styles.errorBanner}>{error}</p> : null}

      <div className={styles.layout}>
        <section className={styles.mapPanel} aria-label="Carte des bâtiments">
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Carte des bâtiments</h2>
            {!loading ? (
              <span className={styles.panelHint}>
                {buildings.length} repère{buildings.length > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
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
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Liste des bâtiments</h2>
            {!loading ? (
              <span className={styles.panelHint}>
                {buildings.length} bâtiment{buildings.length > 1 ? "s" : ""}
              </span>
            ) : null}
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
