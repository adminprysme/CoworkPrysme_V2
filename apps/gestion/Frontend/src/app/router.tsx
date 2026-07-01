import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./AuthProvider.js";
import { AppShell } from "./layout/AppShell.js";
import { PublicOnly, RequireAuth } from "./RequireAuth.js";
import { ThemeProvider } from "./ThemeProvider.js";
import { NAV_ITEMS } from "../config/navigation.js";
import { LoginPage } from "../features/auth/LoginPage.js";
import { DashboardPage } from "../pages/DashboardPage.js";
import { ModuleStubPage } from "../pages/ModuleStubPage.js";

const STUB_PATHS = [
  ...NAV_ITEMS.filter((item) => item.id !== "dashboard").map((item) => item.path),
  "/settings",
];

export function AppRouter() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnly />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                {STUB_PATHS.map((path) => (
                  <Route key={path} path={path} element={<ModuleStubPage />} />
                ))}
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
