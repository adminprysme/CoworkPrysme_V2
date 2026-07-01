import { useTheme } from "../app/ThemeProvider.js";
import styles from "./ThemeToggle.module.css";

function SunIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2.25v2M12 19.75v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2.25 12h2M19.75 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

/** Shared theme control — same provider/localStorage as the app shell (Zone B). */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={isDark ? "Activer le thème clair" : "Activer le thème sombre"}
      title={isDark ? "Thème clair" : "Thème sombre"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
