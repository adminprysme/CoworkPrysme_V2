import type { BuildingFormValues, BuildingStatus } from "../types.js";
import { defaultFloorNames } from "../utils/schedule.js";
import type { BuildingFormErrors } from "../utils/validation.js";
import { BUILDING_DESCRIPTION_MAX_LENGTH } from "@coworkprysme/shared";
import { AddressAutocomplete } from "./AddressAutocomplete.js";
import { PhotoUploadGallery } from "./PhotoUploadGallery.js";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor.js";
import styles from "./BuildingForm.module.css";

interface BuildingFormProps {
  idPrefix: string;
  values: BuildingFormValues;
  errors: BuildingFormErrors;
  onChange: (values: BuildingFormValues) => void;
  onRemovePersistedPhoto?: (storageKey: string) => Promise<void>;
}

export function BuildingForm({
  idPrefix,
  values,
  errors,
  onChange,
  onRemovePersistedPhoto,
}: BuildingFormProps) {
  function patchAddress(addressPatch: Partial<BuildingFormValues["address"]>) {
    onChange({
      ...values,
      address: { ...values.address, ...addressPatch },
      lat: null,
      lng: null,
    });
  }

  function setFloorCount(nextCount: number) {
    const count = Math.max(0, nextCount);
    const names = defaultFloorNames(count);
    const floors = names.map((name, index) => ({
      id: values.floors[index]?.id ?? crypto.randomUUID(),
      name: values.floors[index]?.name ?? name,
    }));
    onChange({ ...values, floors });
  }

  return (
    <div className={styles.form}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Informations générales</h3>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.label}>Nom du bâtiment *</span>
            <input
              id={`${idPrefix}-name`}
              className={styles.input}
              value={values.name}
              onChange={(event) => onChange({ ...values, name: event.target.value })}
            />
            {errors.name ? <p className={styles.fieldError}>{errors.name}</p> : null}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Description</span>
            <textarea
              id={`${idPrefix}-description`}
              className={styles.textarea}
              rows={4}
              maxLength={BUILDING_DESCRIPTION_MAX_LENGTH}
              placeholder="Texte affiché sur le site vitrine (texte brut, sans mise en forme HTML)"
              value={values.description}
              onChange={(event) => onChange({ ...values, description: event.target.value })}
            />
            <p className={styles.charCount}>
              {values.description.length} / {BUILDING_DESCRIPTION_MAX_LENGTH}
            </p>
            {errors.description ? <p className={styles.fieldError}>{errors.description}</p> : null}
          </label>

          <div className={styles.statusToggle} role="group" aria-label="Statut du bâtiment">
            {(["active", "inactive"] as BuildingStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                className={[
                  styles.statusOption,
                  values.status === status ? styles.statusOptionActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onChange({ ...values, status })}
              >
                {status === "active" ? "Actif" : "Inactif"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Adresse</h3>
        <div className={styles.fieldGrid}>
          <AddressAutocomplete
            idPrefix={idPrefix}
            address={values.address}
            onSelect={(geocoded) =>
              onChange({
                ...values,
                address: geocoded.address,
                lat: geocoded.lat,
                lng: geocoded.lng,
              })
            }
          />

          <label className={styles.field}>
            <span className={styles.label}>Rue *</span>
            <input
              className={styles.input}
              value={values.address.street}
              onChange={(event) => patchAddress({ street: event.target.value })}
            />
            {errors.street ? <p className={styles.fieldError}>{errors.street}</p> : null}
          </label>
          <div className={styles.fieldGrid2}>
            <label className={styles.field}>
              <span className={styles.label}>Code postal *</span>
              <input
                className={styles.input}
                value={values.address.postalCode}
                onChange={(event) => patchAddress({ postalCode: event.target.value })}
              />
              {errors.postalCode ? <p className={styles.fieldError}>{errors.postalCode}</p> : null}
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Ville *</span>
              <input
                className={styles.input}
                value={values.address.city}
                onChange={(event) => patchAddress({ city: event.target.value })}
              />
              {errors.city ? <p className={styles.fieldError}>{errors.city}</p> : null}
            </label>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Pays *</span>
            <input
              className={styles.input}
              value={values.address.country}
              onChange={(event) => patchAddress({ country: event.target.value })}
            />
            {errors.country ? <p className={styles.fieldError}>{errors.country}</p> : null}
          </label>
          {errors.coordinates ? <p className={styles.fieldError}>{errors.coordinates}</p> : null}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.floorsHeader}>
          <h3 className={styles.sectionTitle}>Étages</h3>
          <div className={styles.floorControls}>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Retirer un étage"
              disabled={values.floors.length <= 1}
              onClick={() => setFloorCount(values.floors.length - 1)}
            >
              −
            </button>
            <span>{values.floors.length}</span>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Ajouter un étage"
              onClick={() => setFloorCount(values.floors.length + 1)}
            >
              +
            </button>
          </div>
        </div>
        <div className={styles.floorsList}>
          {values.floors.map((floor, index) => (
            <label key={floor.id} className={styles.field}>
              <span className={styles.label}>Étage {index + 1}</span>
              <input
                className={styles.input}
                value={floor.name}
                onChange={(event) =>
                  onChange({
                    ...values,
                    floors: values.floors.map((entry) =>
                      entry.id === floor.id ? { ...entry, name: event.target.value } : entry,
                    ),
                  })
                }
              />
            </label>
          ))}
        </div>
        {errors.floors ? <p className={styles.fieldError}>{errors.floors}</p> : null}
      </section>

      <section className={styles.section}>
        <WeeklyScheduleEditor
          idPrefix={`${idPrefix}-accessibility`}
          title="Horaires d'accessibilité"
          schedules={values.accessibilityHours}
          onChange={(accessibilityHours) => onChange({ ...values, accessibilityHours })}
        />
      </section>

      <section className={styles.section}>
        <WeeklyScheduleEditor
          idPrefix={`${idPrefix}-reception`}
          title="Horaires d'accueil"
          schedules={values.receptionHours}
          onChange={(receptionHours) => onChange({ ...values, receptionHours })}
        />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Conciergerie</h3>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.label}>Lien de la conciergerie</span>
            <input
              className={styles.input}
              type="url"
              placeholder="https://…"
              value={values.concierge.link}
              onChange={(event) =>
                onChange({
                  ...values,
                  concierge: { ...values.concierge, link: event.target.value },
                })
              }
            />
            {errors.conciergeLink ? (
              <p className={styles.fieldError}>{errors.conciergeLink}</p>
            ) : null}
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Code d'accès</span>
            <input
              className={styles.input}
              value={values.concierge.accessCode}
              onChange={(event) =>
                onChange({
                  ...values,
                  concierge: { ...values.concierge, accessCode: event.target.value },
                })
              }
            />
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Photos du bâtiment</h3>
        <PhotoUploadGallery
          photos={values.photos}
          onChange={(photos) => onChange({ ...values, photos })}
          onRemovePersisted={onRemovePersistedPhoto}
        />
        {errors.photos ? <p className={styles.fieldError}>{errors.photos}</p> : null}
      </section>
    </div>
  );
}
