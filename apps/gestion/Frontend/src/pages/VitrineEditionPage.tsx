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
import { VitrineCatalogBuildingsField } from "./components/VitrineCatalogBuildingsField.js";
import { VitrineCatalogSpacesField } from "./components/VitrineCatalogSpacesField.js";
import { VitrineCollapsibleSection } from "./components/VitrineCollapsibleSection.js";
import { VitrineFeaturedBuildingsField } from "./components/VitrineFeaturedBuildingsField.js";
import { VitrineFeaturedSpacesField } from "./components/VitrineFeaturedSpacesField.js";
import { VitrineImageField } from "./components/VitrineImageField.js";
import { VitrineMarqueeField } from "./components/VitrineMarqueeField.js";
import { VitrineSiteContactField } from "./components/VitrineSiteContactField.js";
import styles from "./VitrineEditionPage.module.css";

const VITRINE_SITE_URL = import.meta.env.VITE_VITRINE_URL ?? "http://localhost:3001";

type EditionTab = "accueil" | "services" | "acces" | "apropos" | "espaces";

const TABS: Array<{ id: EditionTab; label: string }> = [
  { id: "accueil", label: "Accueil" },
  { id: "services", label: "Nos services" },
  { id: "espaces", label: "Espaces" },
  { id: "acces", label: "Accès et contact" },
  { id: "apropos", label: "À propos" },
];

const SERVICE_SLOTS: Array<{ slot: VitrineImageSlot; label: string; description: string }> = [
  {
    slot: "room-service",
    label: "Room-Service",
    description: "Visuel de la carte « Room-Service » sur la page d'accueil et /services.",
  },
  {
    slot: "afterwork",
    label: "Afterwork",
    description: "Visuel de la carte « Afterwork » sur la page d'accueil et /services.",
  },
  {
    slot: "conciergerie",
    label: "Conciergerie",
    description: "Visuel de la carte « Conciergerie » sur la page d'accueil et /services.",
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

function normalizeVitrineContent(data: VitrineContentResponse): VitrineContentResponse {
  return {
    ...data,
    siteContact: data.siteContact ?? { email: null, phone: null },
    featuredBuildingIds: data.featuredBuildingIds ?? [],
  };
}

export function VitrineEditionPage() {
  const { user } = useAuth();
  const [content, setContent] = useState<VitrineContentResponse | null>(null);
  const [activeTab, setActiveTab] = useState<EditionTab>("accueil");
  const [marqueeText, setMarqueeText] = useState("");
  const [marqueeEnabled, setMarqueeEnabled] = useState(true);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingMarquee, setSavingMarquee] = useState(false);
  const [savingFeaturedSpaces, setSavingFeaturedSpaces] = useState(false);
  const [savingFeaturedBuildings, setSavingFeaturedBuildings] = useState(false);
  const [savingSiteContact, setSavingSiteContact] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<VitrineImageSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = normalizeVitrineContent(await fetchVitrineContent());
      setContent(data);
      setMarqueeText(data.marquee.text);
      setMarqueeEnabled(data.marquee.enabled);
      setContactEmail(data.siteContact.email ?? "");
      setContactPhone(data.siteContact.phone ?? "");
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
      setContent(normalizeVitrineContent(updated));
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
      setContent(normalizeVitrineContent(updated));
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
      setContent(normalizeVitrineContent(updated));
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

  async function handleSaveSiteContact() {
    setSavingSiteContact(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateVitrineContent({
        siteContact: {
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
        },
      });
      const normalized = normalizeVitrineContent(updated);
      setContent(normalized);
      setContactEmail(normalized.siteContact.email ?? "");
      setContactPhone(normalized.siteContact.phone ?? "");
      setSuccess("Coordonnées mises à jour.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Échec de l'enregistrement des coordonnées.",
      );
    } finally {
      setSavingSiteContact(false);
    }
  }

  async function handleSaveFeaturedSpaces(spaceIds: string[]) {
    setSavingFeaturedSpaces(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateVitrineContent({ featuredSpaceIds: spaceIds });
      setContent(normalizeVitrineContent(updated));
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

  async function handleSaveFeaturedBuildings(buildingIds: string[]) {
    setSavingFeaturedBuildings(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateVitrineContent({ featuredBuildingIds: buildingIds });
      setContent(normalizeVitrineContent(updated));
      setSuccess("Bâtiments affichés mis à jour.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Échec de l'enregistrement des bâtiments.",
      );
    } finally {
      setSavingFeaturedBuildings(false);
    }
  }

  const marqueeDirty =
    content !== null &&
    (marqueeText.trim() !== content.marquee.text || marqueeEnabled !== content.marquee.enabled);

  const siteContactDirty =
    content !== null &&
    (contactEmail.trim() !== (content.siteContact?.email ?? "") ||
      contactPhone.trim() !== (content.siteContact?.phone ?? ""));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Edition Vitrine</h1>
          <p className={styles.subtitle}>
            Contenus, visuels et coordonnées affichés sur le site public
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

          <div className={styles.tabPanels}>
            {activeTab === "accueil" ? (
              <>
                <VitrineCollapsibleSection title="Photo d'accueil">
                  <p className={styles.panelIntro}>
                    Les images défilent automatiquement en haut de la page d&apos;accueil. La
                    première image est affichée en priorité au chargement.
                  </p>
                  <VitrineImageField
                    title="Photos d'accueil"
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
                </VitrineCollapsibleSection>

                <VitrineCollapsibleSection title="Bandeau défilant">
                  <VitrineMarqueeField
                    enabled={marqueeEnabled}
                    text={marqueeText}
                    saving={savingMarquee}
                    dirty={marqueeDirty}
                    onEnabledChange={setMarqueeEnabled}
                    onTextChange={setMarqueeText}
                    onSave={() => void handleSaveMarquee()}
                  />
                </VitrineCollapsibleSection>

                <VitrineCollapsibleSection title={"Photo de l'encart « Le Concept »"}>
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
                </VitrineCollapsibleSection>
              </>
            ) : null}

            {activeTab === "services" ? (
              <>
                <VitrineCollapsibleSection title="Photos des services">
                  <p className={styles.panelIntro}>
                    Personnalisez les visuels des cartes services sur l&apos;accueil et la page
                    /services.
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
                </VitrineCollapsibleSection>

                <VitrineCollapsibleSection title="Fiches produits">
                  <VitrineFeaturedSpacesField
                    selectedIds={content.featuredSpaceIds}
                    saving={savingFeaturedSpaces}
                    onSave={handleSaveFeaturedSpaces}
                  />
                </VitrineCollapsibleSection>
              </>
            ) : null}

            {activeTab === "acces" ? (
              <>
                <VitrineCollapsibleSection title="Coordonnées">
                  <VitrineSiteContactField
                    email={contactEmail}
                    phone={contactPhone}
                    saving={savingSiteContact}
                    dirty={siteContactDirty}
                    onEmailChange={setContactEmail}
                    onPhoneChange={setContactPhone}
                    onSave={() => void handleSaveSiteContact()}
                  />
                </VitrineCollapsibleSection>

                <VitrineCollapsibleSection title="Bâtiments affichés">
                  <VitrineFeaturedBuildingsField
                    selectedIds={content.featuredBuildingIds}
                    saving={savingFeaturedBuildings}
                    onSave={handleSaveFeaturedBuildings}
                  />
                </VitrineCollapsibleSection>
              </>
            ) : null}

            {activeTab === "espaces" ? (
              <>
                <VitrineCollapsibleSection title="Bâtiments catalogue">
                  <VitrineCatalogBuildingsField />
                </VitrineCollapsibleSection>

                <VitrineCollapsibleSection title="Mise en avant des espaces">
                  <VitrineCatalogSpacesField />
                </VitrineCollapsibleSection>
              </>
            ) : null}

            {activeTab === "apropos" ? (
              <VitrineCollapsibleSection title="Le lieu">
                <p className={styles.panelIntro}>
                  Image affichée dans l&apos;encart « Le lieu » sur la page /a-propos.
                </p>
                <VitrineImageField
                  title="Photo du bâtiment"
                  description="Une nouvelle photo remplace automatiquement l'image existante."
                  images={content.placeImage ? [content.placeImage] : []}
                  uploading={uploadingSlot === "place"}
                  emptyMessage="Aucune image personnalisée — un encart placeholder est affiché sur la vitrine."
                  onUpload={(files) => void handleUpload("place", files)}
                  onDelete={(storageKey) => void handleDelete("place", storageKey)}
                  getPreviewUrl={getVitrineImagePreviewUrl}
                />
              </VitrineCollapsibleSection>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
