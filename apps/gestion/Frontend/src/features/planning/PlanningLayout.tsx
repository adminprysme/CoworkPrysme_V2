import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../app/AuthProvider.js";
import styles from "./PlanningLayout.module.css";

export function PlanningLayout() {
  const { user } = useAuth();

  if (!user?.profile.permissions.planning) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={styles.root}>
      <Outlet />
    </div>
  );
}
