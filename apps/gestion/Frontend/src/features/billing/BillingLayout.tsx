import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../app/AuthProvider.js";
import styles from "./BillingLayout.module.css";

export function BillingLayout() {
  const { user } = useAuth();

  if (!user?.profile.permissions.billing) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={styles.root}>
      <Outlet />
    </div>
  );
}
