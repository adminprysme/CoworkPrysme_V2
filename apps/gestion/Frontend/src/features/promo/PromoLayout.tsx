import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../app/AuthProvider.js";
import styles from "./PromoLayout.module.css";

export function PromoLayout() {
  const { user } = useAuth();

  if (!user?.profile.permissions.promo) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={styles.root}>
      <Outlet />
    </div>
  );
}
