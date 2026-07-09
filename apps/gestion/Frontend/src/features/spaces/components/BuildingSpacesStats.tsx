import styles from "./BuildingSpacesStats.module.css";

export interface BuildingSpacesStatsData {
  totalSpaces: number;
  meetingRooms: number;
  privateOffices: number;
}

interface BuildingSpacesStatsProps {
  stats: BuildingSpacesStatsData;
  loading?: boolean;
}

function SpacesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 10h18M8 15h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function MeetingRoomIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M7 10h4M7 14h2M13 10h4M13 14h2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OfficeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M4 19h16M9 7h.01M9 11h.01M9 15h.01M15 7h.01M15 11h.01M15 15h.01"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

const STAT_ITEMS = [
  {
    key: "totalSpaces",
    label: "Espaces actifs",
    accent: "var(--color-secondary)",
    Icon: SpacesIcon,
  },
  {
    key: "meetingRooms",
    label: "Salles de réunion",
    accent: "var(--color-secondary)",
    Icon: MeetingRoomIcon,
  },
  {
    key: "privateOffices",
    label: "Bureaux",
    accent: "var(--color-primary)",
    Icon: OfficeIcon,
  },
] as const;

export function BuildingSpacesStats({ stats, loading = false }: BuildingSpacesStatsProps) {
  return (
    <section className={styles.grid} aria-label="Statistiques des espaces du bâtiment">
      {STAT_ITEMS.map(({ key, label, accent, Icon }) => (
        <article key={key} className={styles.card} style={{ ["--accent" as string]: accent }}>
          <div className={styles.iconWrap}>
            <Icon />
          </div>
          <div className={styles.content}>
            <p className={styles.label}>{label}</p>
            <p
              className={[styles.value, loading ? styles.valueLoading : ""]
                .filter(Boolean)
                .join(" ")}
            >
              {loading ? "—" : stats[key]}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
