"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import styles from "./SearchBar.module.css";

type SpaceType = "meeting_room" | "private_office";

export function SearchBar() {
  const [spaceType, setSpaceType] = useState<SpaceType>("meeting_room");

  return (
    <div className={styles.wrapper} id="recherche">
      <Container>
        <div className={styles.card}>
          <h2 className={styles.title}>Rechercher un espace</h2>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
            }}
            aria-label="Recherche d'espace (aperçu visuel)"
          >
            <div className={styles.field}>
              <span className={styles.label} id="search-type-label">
                Type d&apos;espace
              </span>
              <div className={styles.typeToggle} role="group" aria-labelledby="search-type-label">
                <button
                  type="button"
                  className={[
                    styles.typeOption,
                    spaceType === "meeting_room" ? styles.typeOptionActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSpaceType("meeting_room")}
                >
                  Salle de réunion
                </button>
                <button
                  type="button"
                  className={[
                    styles.typeOption,
                    spaceType === "private_office" ? styles.typeOptionActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSpaceType("private_office")}
                >
                  Bureau
                </button>
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Date</span>
              <input className={styles.input} type="date" defaultValue="2026-07-15" />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Nombre de personnes</span>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={50}
                defaultValue={4}
                inputMode="numeric"
              />
            </label>

            <div className={[styles.field, styles.submitField].join(" ")}>
              <span className={styles.label} aria-hidden="true">
                Action
              </span>
              <Button type="submit" variant="primary" fullWidth size="lg">
                Rechercher
              </Button>
            </div>
          </form>
          <p className={styles.note}>
            Aperçu visuel — la recherche en ligne sera disponible prochainement.
          </p>
        </div>
      </Container>
    </div>
  );
}
