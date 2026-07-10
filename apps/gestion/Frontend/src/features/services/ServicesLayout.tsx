import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../app/AuthProvider.js";
import styles from "./ServicesLayout.module.css";

export function ServicesLayout() {
  const { user } = useAuth();

  if (!user?.profile.permissions.services) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={styles.root}>
      <Outlet />
    </div>
  );
}
