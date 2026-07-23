import { Navigate, NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../app/AuthProvider.js";
import styles from "./BillingLayout.module.css";

const TABS = [
  { to: "/billing", end: true, label: "Virements" },
  { to: "/billing/quotes", end: false, label: "Devis" },
  { to: "/billing/invoices", end: true, label: "Factures" },
] as const;

export function BillingLayout() {
  const { user } = useAuth();

  if (!user?.profile.permissions.billing) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={styles.root}>
      <nav className={styles.tabs} aria-label="Facturation">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.outlet}>
        <Outlet />
      </div>
    </div>
  );
}
