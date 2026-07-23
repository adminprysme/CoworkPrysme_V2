import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";

import { useAuth } from "./AuthProvider.js";

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: "2rem" }}>Chargement…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

/**
 * Blocks authenticated users from public routes — except during the SSO
 * callback (`?sso_token=`), so LoginPage can finish its fullscreen transition
 * even if AuthProvider already hydrated a session (or loginSso set the cookie).
 */
export function PublicOnly() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const ssoTransition = searchParams.has("sso_token");

  if (loading && !ssoTransition) {
    return <div style={{ padding: "2rem" }}>Chargement…</div>;
  }

  if (user && !ssoTransition) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
