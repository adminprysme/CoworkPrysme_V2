import type { SpaceFormValues } from "../space-types.js";
import { SPACE_TYPE_LABELS } from "../space-types.js";
import type { SpaceFormErrors } from "../utils/space-validation.js";
import { EquipmentPicker } from "./EquipmentPicker.js";
import { PhotoUploadGallery } from "./PhotoUploadGallery.js";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor.js";
import styles from "./SpaceForm.module.css";

interface SpaceFormProps {
  idPrefix: string;
  values: SpaceFormValues;
  errors: SpaceFormErrors;
  floorNames: string[];
  onChange: (values: SpaceFormValues) => void;
}

export function SpaceForm({ idPrefix, values, errors, floorNames, onChange }: SpaceFormProps) {
  const capacityLabel =
    values.type === "private_office" ? "Nombre de postes" : "Capacité (personnes)";

  return (
    <div className={styles.form}>
      <fieldset className={styles.typeFieldset}>
        <legend className={styles.sectionTitle}>Type d&apos;espace</legend>
        <div className={styles.typeChoices} role="radiogroup" aria-label="Type d'espace">
          {(Object.keys(SPACE_TYPE_LABELS) as SpaceFormValues["type"][]).map((type) => (
            <label
              key={type}
              className={[styles.typeChoice, values.type === type ? styles.typeChoiceActive : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="radio"
                name={`${idPrefix}-space-type`}
                checked={values.type === type}
                onChange={() =>
                  onChange({
                    ...values,
                    type,
                    capacity:
                      type === "private_office"
                        ? Math.min(values.capacity, 6) || 2
                        : Math.max(values.capacity, 4),
                  })
                }
              />
              <span className={styles.typeChoiceLabel}>{SPACE_TYPE_LABELS[type]}</span>
              <span className={styles.typeChoiceHint}>
                {type === "meeting_room"
                  ? "Salles équipées pour réunions et visioconférences."
                  : "Bureaux fermés pour équipes ou indépendants."}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className={styles.section}>
        <label className={styles.field} htmlFor={`${idPrefix}-name`}>
          <span className={styles.label}>Nom *</span>
          <input
            id={`${idPrefix}-name`}
            className={styles.input}
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
          />
          {errors.name ? <span className={styles.error}>{errors.name}</span> : null}
        </label>

        <label className={styles.field} htmlFor={`${idPrefix}-description`}>
          <span className={styles.label}>Description</span>
          <textarea
            id={`${idPrefix}-description`}
            className={styles.textarea}
            rows={3}
            value={values.description}
            onChange={(event) => onChange({ ...values, description: event.target.value })}
          />
        </label>

        <label className={styles.field} htmlFor={`${idPrefix}-floor`}>
          <span className={styles.label}>Étage *</span>
          <select
            id={`${idPrefix}-floor`}
            className={styles.input}
            value={values.floor}
            onChange={(event) => onChange({ ...values, floor: event.target.value })}
          >
            {floorNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {errors.floor ? <span className={styles.error}>{errors.floor}</span> : null}
        </label>

        <label className={styles.field} htmlFor={`${idPrefix}-capacity`}>
          <span className={styles.label}>{capacityLabel} *</span>
          <input
            id={`${idPrefix}-capacity`}
            type="number"
            min={1}
            className={styles.input}
            value={values.capacity}
            onChange={(event) =>
              onChange({ ...values, capacity: Number.parseInt(event.target.value, 10) || 0 })
            }
          />
          {errors.capacity ? <span className={styles.error}>{errors.capacity}</span> : null}
        </label>
      </section>

      <section className={styles.section}>
        <EquipmentPicker
          idPrefix={idPrefix}
          selected={values.equipments}
          onChange={(equipments) => onChange({ ...values, equipments })}
        />
      </section>

      <section className={styles.section}>
        <WeeklyScheduleEditor
          idPrefix={`${idPrefix}-opening`}
          title="Horaires d'ouverture de l'espace"
          schedules={values.openingHours}
          onChange={(openingHours) => onChange({ ...values, openingHours })}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.statusRow}>
          <span className={styles.label}>Statut</span>
          <label className={styles.statusToggle}>
            <input
              type="checkbox"
              checked={values.status === "active"}
              onChange={(event) =>
                onChange({ ...values, status: event.target.checked ? "active" : "inactive" })
              }
            />
            <span>{values.status === "active" ? "Actif" : "Inactif"}</span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Photos de l&apos;espace</h3>
        <PhotoUploadGallery
          photos={values.photos}
          onChange={(photos) => onChange({ ...values, photos })}
        />
      </section>
    </div>
  );
}
