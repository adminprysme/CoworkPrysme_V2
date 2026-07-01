import { Outlet, Navigate } from "react-router-dom";

import { useAuth } from "../../app/AuthProvider.js";

export function SpacesLayout() {
  const { user } = useAuth();

  if (!user?.profile.permissions.spaces) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
