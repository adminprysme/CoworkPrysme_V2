import { useAuth } from "../app/AuthProvider.js";
import styles from "./DashboardPage.module.css";

export function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <img src="/logo-icon.png" alt="" className={styles.logoIcon} />
        <div>
          <h1>Tableau de bord</h1>
          <p className={styles.subtitle}>Cowork Prysme — Gestion</p>
        </div>
      </header>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>Session active</h2>
          <p>
            <strong>{user.profile.displayName}</strong>
          </p>
          <p className={styles.meta}>
            Rôle : {user.profile.role === "admin" ? "Administrateur" : "Gestionnaire"}
          </p>
          <p className={styles.meta}>Source : {user.authSource}</p>
        </article>

        <article className={styles.card}>
          <h2>Permissions</h2>
          <ul className={styles.list}>
            {Object.entries(user.profile.permissions).map(([key, enabled]) => (
              <li key={key}>
                {key} : {enabled ? "oui" : "non"}
              </li>
            ))}
          </ul>
        </article>

        <article className={styles.card}>
          <h2>Modules à venir</h2>
          <p className={styles.meta}>Planning, réservations, facturation…</p>
        </article>
      </section>
    </div>
  );
}
