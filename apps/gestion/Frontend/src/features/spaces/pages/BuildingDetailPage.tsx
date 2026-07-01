import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { deleteBuilding, fetchBuilding, updateBuilding } from "../../../lib/buildings-api.js";
import {
  buildingResponseToFormValues,
  formValuesToCreateRequest,
} from "../../../lib/buildings-mappers.js";
import {
  persistBuildingPhotos,
  removePersistedBuildingPhoto,
} from "../../../lib/buildings-photos.js";
import { BuildingForm } from "../components/BuildingForm.js";
import { BuildingSpacesTab } from "../components/BuildingSpacesTab.js";
import { revokePhotoUrls } from "../utils/photos.js";
import type { BuildingFormValues } from "../types.js";
import { validateBuildingForm, type BuildingFormErrors } from "../utils/validation.js";
import styles from "./BuildingDetailPage.module.css";

type DetailTab = "building" | "spaces" | "danger";

const TABS: { id: DetailTab; label: string; danger?: boolean }[] = [
  { id: "building", label: "Bâtiment" },
  { id: "spaces", label: "Espaces" },
  { id: "danger", label: "Zone de danger", danger: true },
];

export function BuildingDetailPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();

  const [buildingName, setBuildingName] = useState("");
  const [tab, setTab] = useState<DetailTab>("building");
  const [values, setValues] = useState<BuildingFormValues | null>(null);
  const [errors, setErrors] = useState<BuildingFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const photosRef = useRef<BuildingFormValues["photos"]>([]);

  photosRef.current = values?.photos ?? [];

  useEffect(() => {
    if (!buildingId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void fetchBuilding(buildingId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setBuildingName(response.name);
        setValues(buildingResponseToFormValues(response));
        setErrors({});
        setSaved(false);
        setConfirmName("");
        setTab("building");
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Bâtiment introuvable.");
          setValues(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  useEffect(() => {
    return () => {
      revokePhotoUrls(photosRef.current);
    };
  }, []);

  if (!buildingId) {
    return <Navigate to="/spaces" replace />;
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.stubMessage}>Chargement du bâtiment…</p>
      </div>
    );
  }

  if (loadError || !values) {
    return (
      <div className={styles.page}>
        <Link to="/spaces" className={styles.backBtn}>
          ← Retour aux bâtiments
        </Link>
        <p className={styles.stubMessage}>{loadError ?? "Bâtiment introuvable."}</p>
      </div>
    );
  }

  const currentBuildingId = buildingId;
  const formValues = values;

  async function handleSave() {
    const nextErrors = validateBuildingForm(formValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const updated = await updateBuilding(
        currentBuildingId,
        formValuesToCreateRequest(formValues),
      );
      const photos = await persistBuildingPhotos(currentBuildingId, formValues.photos);
      setBuildingName(updated.name);
      setValues({
        ...buildingResponseToFormValues(updated),
        photos,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setErrors({ coordinates: "Impossible d'enregistrer ce bâtiment." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (confirmName.trim() !== buildingName) {
      return;
    }

    setDeleting(true);
    try {
      await deleteBuilding(currentBuildingId);
      void navigate("/spaces", { replace: true });
    } catch {
      setLoadError("Impossible de supprimer ce bâtiment.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={[styles.page, tab === "spaces" ? styles.pageWide : ""].filter(Boolean).join(" ")}
    >
      <nav aria-label="Fil d'Ariane">
        <ol className={styles.breadcrumb}>
          <li>
            <Link to="/spaces">Bâtiments &amp; Espaces</Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>{buildingName}</li>
        </ol>
      </nav>

      <header className={styles.header}>
        <h1>{buildingName}</h1>
        <p className={styles.subtitle}>Gestion du bâtiment</p>
      </header>

      <Link to="/spaces" className={styles.backBtn}>
        ← Retour aux bâtiments
      </Link>

      <div className={styles.tabs} role="tablist" aria-label="Sections du bâtiment">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={[
              styles.tab,
              tab === entry.id ? styles.tabActive : "",
              entry.danger ? styles.tabDanger : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className={styles.panel} role="tabpanel">
        {tab === "building" ? (
          <>
            <BuildingForm
              idPrefix={`edit-${currentBuildingId}`}
              values={formValues}
              errors={errors}
              onChange={(nextValues) => {
                setValues(nextValues);
                setSaved(false);
              }}
              onRemovePersistedPhoto={async (storageKey) => {
                await removePersistedBuildingPhoto(currentBuildingId, storageKey);
                setValues((current) =>
                  current
                    ? {
                        ...current,
                        photos: current.photos.filter((photo) => photo.storageKey !== storageKey),
                      }
                    : current,
                );
              }}
            />
            <div className={styles.saveBar}>
              {saved ? <p className={styles.savedHint}>Modifications enregistrées</p> : null}
              <button
                type="button"
                className={styles.saveBtn}
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </>
        ) : null}

        <div hidden={tab !== "spaces"}>
          <BuildingSpacesTab
            buildingId={currentBuildingId}
            buildingName={buildingName}
            floorNames={formValues.floors.map((floor) => floor.name)}
            buildingHours={formValues.accessibilityHours}
          />
        </div>

        {tab === "danger" ? (
          <div className={styles.dangerPanel}>
            <h2 className={styles.dangerTitle}>Supprimer ce bâtiment</h2>
            <p className={styles.dangerText}>
              Cette action est irréversible. Le bâtiment sera retiré de la liste et de la carte.
            </p>
            <label className={styles.confirmField}>
              <span className={styles.confirmLabel}>
                Saisissez le nom du bâtiment pour confirmer
              </span>
              <input
                className={styles.confirmInput}
                value={confirmName}
                placeholder={buildingName}
                onChange={(event) => setConfirmName(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.deleteBtn}
              disabled={deleting || confirmName.trim() !== buildingName}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
