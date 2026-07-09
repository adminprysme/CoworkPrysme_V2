import { useCallback, useEffect, useState } from "react";

import { VITRINE_HERO_MAX_IMAGES } from "@coworkprysme/shared";
import { Navigate } from "react-router-dom";

import { useAuth } from "../app/AuthProvider.js";
import {
  deleteVitrineImage,
  fetchVitrineContent,
  getVitrineImagePreviewUrl,
  updateVitrineContent,
  uploadVitrineImage,
  type VitrineContentResponse,
  type VitrineImageSlot,
} from "../lib/vitrine-content-api.js";
import { VitrineImageField } from "./components/VitrineImageField.js";
import { VitrineFeaturedSpacesField } from "./components/VitrineFeaturedSpacesField.js";
import styles from "./VitrineEditionPage.module.css";

const VITRINE_SITE_URL = import.meta.env.VITE_VITRINE_URL ?? "http://localhost:3001";

type EditionTab = "accueil" | "contenu" | "services" | "bandeau";

const TABS: Array<{ id: EditionTab; label: string }> = [
  { id: "accueil", label: "Accueil" },
  { id: "contenu", label: "Le Concept" },
  { id: "services", label: "Services" },
  { id: "bandeau", label: "Bandeau" },
];

const SERVICE_SLOTS: Array<{ slot: VitrineImageSlot; label: string; description: string }> = [
  {
    slot: "room-service",
    label: "Room-Service",
    description: "Visuel de la carte « Room-Service » sur la page d'accueil.",
  },
  {
    slot: "afterwork",
    label: "Afterwork",
    description: "Visuel de la carte « Afterwork » sur la page d'accueil.",
  },
  {
    slot: "conciergerie",
    label: "Conciergerie",
    description: "Visuel de la carte « Conciergerie » sur la page d'accueil.",
  },
];

function getServiceImageKey(
  content: VitrineContentResponse,
  slot: VitrineImageSlot,
): string | null {
  switch (slot) {
    case "room-service":
      return content.serviceImages.roomService;
    case "afterwork":
      return content.serviceImages.afterwork;
    case "conciergerie":
      return content.serviceImages.conciergerie;
    default:
      return null;
  }
}

export function VitrineEditionPage() {
  const { user } = useAuth();
  const [content, setContent] = useState<VitrineContentResponse | null>(null);
  const [activeTab, setActiveTab] = useState<EditionTab>("accueil");
  const [marqueeText, setMarqueeText] = useState("");
  const [marqueeEnabled, setMarqueeEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingMarquee, setSavingMarquee] = useState(false);
  const [savingFeaturedSpaces, setSavingFeaturedSpaces] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<VitrineImageSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVitrineContent();
      setContent(data);
      setMarqueeText(data.marquee.text);
      setMarqueeEnabled(data.marquee.enabled);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger le contenu vitrine.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  useEffect(() => {
    if (!success) {
      return;
    }
    const timer = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  if (!user || user.profile.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleUpload(slot: VitrineImageSlot, fileList: FileList) {
    const files = Array.from(fileList);
    if (files.length === 0) {
      return;
    }

    setUploadingSlot(slot);
    setError(null);
    setSuccess(null);
    try {
      let updated = content!;
      for (const file of files) {
        updated = await uploadVitrineImage(slot, file);
      }
      setContent(updated);
      setSuccess(files.length > 1 ? `${files.length} images enregistrées.` : "Image enregistrée.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Échec de l'envoi de l'image.");
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleDelete(slot: VitrineImageSlot, storageKey: string) {
    setError(null);
    setSuccess(null);
    try {
      const updated = await deleteVitrineImage(slot, storageKey);
      setContent(updated);
      setSuccess("Image supprimée.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Échec de la suppression.");
    }
  }

  async function handleSaveMarquee() {
    setSavingMarquee(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateVitrineContent({
        marquee: {
          enabled: marqueeEnabled,
          text: marqueeText.trim(),
        },
      });
      setContent(updated);
      setMarqueeText(updated.marquee.text);
      setMarqueeEnabled(updated.marquee.enabled);
      setSuccess("Bandeau mis à jour.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Échec de l'enregistrement du bandeau.",
      );
    } finally {
      setSavingMarquee(false);
    }
  }

  async function handleSaveFeaturedSpaces(spaceIds: string[]) {
    setSavingFeaturedSpaces(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateVitrineContent({ featuredSpaceIds: spaceIds });
      setContent(updated);
      setSuccess("Fiches produits mises à jour.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Échec de l'enregistrement des fiches produits.",
      );
    } finally {
      setSavingFeaturedSpaces(false);
    }
  }

  const marqueeDirty =
    content !== null &&
    (marqueeText.trim() !== content.marquee.text || marqueeEnabled !== content.marquee.enabled);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Edition Vitrine</h1>
          <p className={styles.subtitle}>
            Visuels et bandeau d&apos;information affichés sur le site public
          </p>
        </div>
        <a
          href={VITRINE_SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.secondaryBtn}
        >
          Voir le site vitrine ↗
        </a>
      </header>

      <div className={styles.feedbackStack}>
        {error ? <p className={styles.errorBanner}>{error}</p> : null}
        {success ? <p className={styles.successBanner}>{success}</p> : null}
      </div>

      {loading ? (
        <p className={styles.loadingState}>Chargement du contenu vitrine…</p>
      ) : !content ? (
        <p className={styles.errorBanner}>{error ?? "Contenu indisponible."}</p>
      ) : (
        <>
          <div className={styles.tabs} role="tablist" aria-label="Sections de l'édition vitrine">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={[styles.tab, activeTab === tab.id ? styles.tabActive : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "accueil" ? (
            <section className={styles.panel} aria-label="Photo d'accueil">
              <div className={styles.panelHeader}>Carousel d&apos;accueil</div>
              <div className={styles.panelBody}>
                <p className={styles.panelIntro}>
                  Les images défilent automatiquement en haut de la page d&apos;accueil. La première
                  image est affichée en priorité au chargement.
                </p>
                <VitrineImageField
                  title="Photos du hero"
                  description="Ajoutez jusqu'à 8 visuels pour le bandeau principal."
                  images={content.heroImages}
                  multiple
                  maxImages={VITRINE_HERO_MAX_IMAGES}
                  uploading={uploadingSlot === "hero"}
                  emptyMessage="Aucune image personnalisée — les visiteurs voient l'image par défaut."
                  onUpload={(files) => void handleUpload("hero", files)}
                  onDelete={(storageKey) => void handleDelete("hero", storageKey)}
                  getPreviewUrl={getVitrineImagePreviewUrl}
                />
              </div>
            </section>
          ) : null}

          {activeTab === "contenu" ? (
            <section className={styles.panel} aria-label="Le Concept">
              <div className={styles.panelHeader}>Encart « Le Concept »</div>
              <div className={styles.panelBody}>
                <p className={styles.panelIntro}>
                  Image affichée dans la section « Le Concept », sous la barre de recherche sur
                  l&apos;accueil.
                </p>
                <VitrineImageField
                  title="Visuel principal"
                  description="Une nouvelle photo remplace automatiquement l'image existante."
                  images={content.conceptImage ? [content.conceptImage] : []}
                  uploading={uploadingSlot === "concept"}
                  onUpload={(files) => void handleUpload("concept", files)}
                  onDelete={(storageKey) => void handleDelete("concept", storageKey)}
                  getPreviewUrl={getVitrineImagePreviewUrl}
                />
              </div>
            </section>
          ) : null}

          {activeTab === "services" ? (
            <section className={styles.panel} aria-label="Services">
              <div className={styles.panelHeader}>Services & fiches produits</div>
              <div className={styles.panelBody}>
                <p className={styles.panelIntro}>
                  Personnalisez les visuels des cartes services sur l&apos;accueil et les fiches
                  produits affichées sur la page /services.
                </p>
                <div className={styles.servicesGrid}>
                  {SERVICE_SLOTS.map(({ slot, label, description }) => {
                    const storageKey = getServiceImageKey(content, slot);
                    return (
                      <div key={slot} className={styles.serviceCard}>
                        <VitrineImageField
                          title={label}
                          description={description}
                          images={storageKey ? [storageKey] : []}
                          uploading={uploadingSlot === slot}
                          onUpload={(files) => void handleUpload(slot, files)}
                          onDelete={(key) => void handleDelete(slot, key)}
                          getPreviewUrl={getVitrineImagePreviewUrl}
                        />
                      </div>
                    );
                  })}
                </div>

                <VitrineFeaturedSpacesField
                  selectedIds={content.featuredSpaceIds}
                  saving={savingFeaturedSpaces}
                  onSave={handleSaveFeaturedSpaces}
                />
              </div>
            </section>
          ) : null}

          {activeTab === "bandeau" ? (
            <section className={styles.panel} aria-label="Bandeau d'information">
              <div className={styles.panelHeader}>Bandeau défilant</div>
              <div className={styles.panelBody}>
                <p className={styles.panelIntro}>
                  Texte affiché sous la barre de recherche (ex. annonce tramway T9). Le bandeau
                  défile en continu lorsqu&apos;il est activé.
                </p>

                <div className={styles.marqueeSection}>
                  <div className={styles.marqueeHeader}>
                    <div>
                      <h3 className={styles.marqueeTitle}>Visibilité</h3>
                      <p className={styles.marqueeHint}>
                        Contrôle l&apos;affichage sur le site public.
                      </p>
                    </div>
                    <div className={styles.toggle} role="group" aria-label="Afficher le bandeau">
                      <button
                        type="button"
                        className={[
                          styles.toggleOption,
                          marqueeEnabled ? styles.toggleOptionSelected : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={marqueeEnabled}
                        onClick={() => setMarqueeEnabled(true)}
                      >
                        Visible
                      </button>
                      <button
                        type="button"
                        className={[
                          styles.toggleOption,
                          !marqueeEnabled ? styles.toggleOptionSelectedOff : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-pressed={!marqueeEnabled}
                        onClick={() => setMarqueeEnabled(false)}
                      >
                        Masqué
                      </button>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="marquee-text">
                      Texte du bandeau
                    </label>
                    <textarea
                      id="marquee-text"
                      className={styles.textarea}
                      value={marqueeText}
                      disabled={!marqueeEnabled}
                      maxLength={500}
                      placeholder="Ex. Le Tramway T9 arrive au pied de l'immeuble à la fin de l'automne 2026"
                      onChange={(event) => setMarqueeText(event.target.value)}
                    />
                    <p className={styles.charCount}>{marqueeText.length} / 500</p>
                  </div>

                  {marqueeEnabled && marqueeText.trim().length > 0 ? (
                    <div className={styles.previewMarquee} aria-hidden="true">
                      <span className={styles.previewMarqueeTrack}>{marqueeText.trim()}</span>
                    </div>
                  ) : null}

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={savingMarquee || marqueeText.trim().length === 0 || !marqueeDirty}
                      onClick={() => void handleSaveMarquee()}
                    >
                      {savingMarquee ? "Enregistrement…" : "Enregistrer le bandeau"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
