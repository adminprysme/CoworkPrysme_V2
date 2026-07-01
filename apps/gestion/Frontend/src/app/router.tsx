import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./AuthProvider.js";
import { PublicOnly, RequireAuth } from "./RequireAuth.js";
import { ThemeProvider } from "./ThemeProvider.js";
import { LoginPage } from "../features/auth/LoginPage.js";
import { DashboardPage } from "../pages/DashboardPage.js";

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
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
