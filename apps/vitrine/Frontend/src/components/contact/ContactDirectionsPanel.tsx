"use client";

import { useState, type ReactNode } from "react";

import { CONTACT_PAGE, type DirectionsModeId, type TransportLine } from "@/config/contact-page";
import { TransportIcon } from "./TransportIcon";
import styles from "./ContactDirectionsPanel.module.css";

interface ContactDirectionsPanelProps {
  address: string;
  directionsUrl: string;
}

function appendTravelMode(url: string, mode: "walking" | "bicycling" | "driving"): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}travelmode=${mode}`;
}

function TransitLines({ lines }: { lines: readonly TransportLine[] }) {
  return (
    <ul className={styles.transitList}>
      {lines.map((line) => (
        <li key={line.label} className={styles.transitItem}>
          <div className={styles.transitIcon}>
            <TransportIcon type={line.icon} />
          </div>
          <div className={styles.transitBody}>
            <div className={styles.transitLabelRow}>
              <h3 className={styles.transitLabel}>{line.label}</h3>
              {line.note ? <span className={styles.transitBadge}>{line.note}</span> : null}
            </div>
            {line.href ? (
              <a
                href={line.href}
                className={styles.transitLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {line.detail}
              </a>
            ) : (
              <p className={styles.transitDetail}>{line.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ModeCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.modeCard}>
      <div className={styles.modeCardHeader}>
        <div className={styles.modeCardIcon}>{icon}</div>
        <h3 className={styles.modeCardTitle}>{title}</h3>
      </div>
      <div className={styles.modeCardBody}>{children}</div>
    </article>
  );
}

export function ContactDirectionsPanel({ address, directionsUrl }: ContactDirectionsPanelProps) {
  const [activeMode, setActiveMode] = useState<DirectionsModeId>("transit");
  const { directions } = CONTACT_PAGE;

  return (
    <article className={styles.panel}>
      <header className={styles.panelHeader}>
        <p className={styles.panelEyebrow}>Accès</p>
        <h2 className={styles.panelTitle}>{directions.title}</h2>
      </header>

      <div className={styles.tabBar} role="tablist" aria-label={directions.title}>
        {directions.modes.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              role="tab"
              id={`directions-tab-${mode.id}`}
              aria-selected={isActive}
              aria-controls={`directions-panel-${mode.id}`}
              className={[styles.tab, isActive ? styles.tabActive : ""].filter(Boolean).join(" ")}
              onClick={() => setActiveMode(mode.id)}
            >
              <span className={styles.tabIcon}>
                <TransportIcon type={mode.icon} size={16} />
              </span>
              <span className={styles.tabLabel}>{mode.label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.panelContent}>
        {activeMode === "transit" ? (
          <div
            role="tabpanel"
            id="directions-panel-transit"
            aria-labelledby="directions-tab-transit"
            className={styles.tabPanel}
          >
            <TransitLines lines={CONTACT_PAGE.publicTransport.lines} />
          </div>
        ) : null}

        {activeMode === "taxi" ? (
          <div
            role="tabpanel"
            id="directions-panel-taxi"
            aria-labelledby="directions-tab-taxi"
            className={styles.tabPanel}
          >
            <ModeCard icon={<TransportIcon type="taxi" />} title={directions.taxi.label}>
              <p className={styles.modeText}>{directions.taxi.detail}</p>
            </ModeCard>
          </div>
        ) : null}

        {activeMode === "bike" ? (
          <div
            role="tabpanel"
            id="directions-panel-bike"
            aria-labelledby="directions-tab-bike"
            className={styles.tabPanel}
          >
            <ModeCard icon={<TransportIcon type="bike" />} title="À vélo">
              <p className={styles.modeText}>{directions.bike.description}</p>
              <div className={styles.modeActions}>
                <a
                  href={directions.bike.href}
                  className={styles.secondaryAction}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {directions.bike.linkLabel}
                </a>
                <a
                  href={appendTravelMode(directionsUrl, "bicycling")}
                  className={styles.primaryAction}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {directions.bike.directionsLabel}
                </a>
              </div>
            </ModeCard>
          </div>
        ) : null}

        {activeMode === "car" ? (
          <div
            role="tabpanel"
            id="directions-panel-car"
            aria-labelledby="directions-tab-car"
            className={styles.tabPanel}
          >
            <ModeCard icon={<TransportIcon type="car" />} title="En voiture">
              <div className={styles.modeSubsection}>
                <h4 className={styles.modeSubheading}>{CONTACT_PAGE.car.parkingTitle}</h4>
                <p className={styles.modeText}>{CONTACT_PAGE.car.parkingPlaces}</p>
                <p className={styles.modeHighlight}>{CONTACT_PAGE.car.parkingRate}</p>
              </div>
              <p className={styles.modeText}>{address}</p>
              <p className={styles.modeText}>{CONTACT_PAGE.car.chargingNearby}</p>
              <p className={styles.modeMuted}>{CONTACT_PAGE.car.onSiteCharging}</p>
              <div className={styles.modeActions}>
                <a
                  href={appendTravelMode(directionsUrl, "driving")}
                  className={styles.primaryAction}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {CONTACT_PAGE.car.directionsLabel}
                </a>
              </div>
            </ModeCard>
          </div>
        ) : null}

        {activeMode === "walk" ? (
          <div
            role="tabpanel"
            id="directions-panel-walk"
            aria-labelledby="directions-tab-walk"
            className={styles.tabPanel}
          >
            <ModeCard icon={<TransportIcon type="walk" />} title="À pied">
              <p className={styles.modeText}>{directions.walk.description}</p>
              <div className={styles.modeActions}>
                <a
                  href={appendTravelMode(directionsUrl, "walking")}
                  className={styles.primaryAction}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {directions.walk.directionsLabel}
                </a>
              </div>
            </ModeCard>
          </div>
        ) : null}
      </div>
    </article>
  );
}
