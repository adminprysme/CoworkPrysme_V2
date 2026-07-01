import { useTheme } from "../app/ThemeProvider.js";
import styles from "./ThemeToggleSwitch.module.css";

function MoonIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 14.5A7.5 7.5 0 0 1 9.5 4 6 6 0 1 0 20 14.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Row toggle — same ThemeProvider / gestion-theme persistence as login control. */
export function ThemeToggleSwitch() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={styles.row}>
      <span className={styles.iconWrap} aria-hidden="true">
        <MoonIcon />
      </span>
      <span className={styles.label}>Mode sombre</span>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Désactiver le mode sombre" : "Activer le mode sombre"}
        className={[styles.switch, isDark ? styles.switchOn : ""].filter(Boolean).join(" ")}
        onClick={toggleTheme}
      >
        <span className={styles.knob} />
      </button>
    </div>
  );
}
