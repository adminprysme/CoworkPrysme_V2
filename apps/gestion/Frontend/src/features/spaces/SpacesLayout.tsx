import { Outlet, Navigate } from "react-router-dom";

import { useAuth } from "../../app/AuthProvider.js";
import styles from "./SpacesLayout.module.css";

export function SpacesLayout() {
  const { user } = useAuth();

  if (!user?.profile.permissions.spaces) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={styles.root}>
      <Outlet />
    </div>
  );
}
