import type { DaySchedule } from "../types.js";
import type { SpaceFormValues, SpaceStatus } from "../space-types.js";
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
  buildingHours: DaySchedule[];
  onChange: (values: SpaceFormValues) => void;
}

export function SpaceForm({
  idPrefix,
  values,
  errors,
  floorNames,
  buildingHours,
  onChange,
}: SpaceFormProps) {
  const capacityLabel =
    values.type === "private_office" ? "Nombre de postes" : "Capacité (personnes)";

  function setUseBuildingHours(checked: boolean) {
    if (checked) {
      onChange({
        ...values,
        useBuildingHours: true,
        openingHours: buildingHours.map((entry) => ({ ...entry })),
      });
      return;
    }
    onChange({ ...values, useBuildingHours: false });
  }

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
        <div className={styles.nameRow}>
          <label className={styles.nameField} htmlFor={`${idPrefix}-name`}>
            <span className={styles.label}>Nom *</span>
            <input
              id={`${idPrefix}-name`}
              className={styles.input}
              value={values.name}
              onChange={(event) => onChange({ ...values, name: event.target.value })}
            />
            {errors.name ? <span className={styles.error}>{errors.name}</span> : null}
          </label>

          <div className={styles.statusToggle} role="group" aria-label="Statut de l'espace">
            {(["active", "inactive"] as SpaceStatus[]).map((status) => (
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

        <label className={styles.field} htmlFor={`${idPrefix}-access-code`}>
          <span className={styles.label}>Code d&apos;accès</span>
          <input
            id={`${idPrefix}-access-code`}
            className={styles.input}
            placeholder="Code serrure salle / bureau (optionnel)"
            value={values.accessCode}
            onChange={(event) => onChange({ ...values, accessCode: event.target.value })}
          />
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
          disabled={values.useBuildingHours}
          onChange={(openingHours) =>
            onChange({ ...values, openingHours, useBuildingHours: false })
          }
          headerExtra={
            <label className={styles.sameBuildingCheck}>
              <input
                type="checkbox"
                checked={values.useBuildingHours}
                onChange={(event) => setUseBuildingHours(event.target.checked)}
              />
              <span>Même horaire que le bâtiment</span>
            </label>
          }
        />
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
