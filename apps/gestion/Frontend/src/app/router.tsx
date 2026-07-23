import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./AuthProvider.js";
import { AppShell } from "./layout/AppShell.js";
import { PublicOnly, RequireAuth } from "./RequireAuth.js";
import { ThemeProvider } from "./ThemeProvider.js";
import { NAV_ITEMS } from "../config/navigation.js";
import { LoginPage } from "../features/auth/LoginPage.js";
import { BuildingsPage } from "../features/spaces/pages/BuildingsPage.js";
import { BuildingDetailPage } from "../features/spaces/pages/BuildingDetailPage.js";
import { SpacesLayout } from "../features/spaces/SpacesLayout.js";
import { ServicesLayout } from "../features/services/ServicesLayout.js";
import { ServicesPage } from "../features/services/pages/ServicesPage.js";
import { PromoLayout } from "../features/promo/PromoLayout.js";
import { PromoCodesPage } from "../features/promo/pages/PromoCodesPage.js";
import { BillingLayout } from "../features/billing/BillingLayout.js";
import { InvoicesPlaceholderPage } from "../features/billing/pages/InvoicesPlaceholderPage.js";
import { MarkTransferReceivedPage } from "../features/billing/pages/MarkTransferReceivedPage.js";
import { QuotesListPage } from "../features/billing/pages/QuotesListPage.js";
import { QuoteWizardPage } from "../features/billing/pages/QuoteWizardPage.js";
import { PlanningLayout } from "../features/planning/PlanningLayout.js";
import { PlanningPage } from "../features/planning/pages/PlanningPage.js";
import { DashboardPage } from "../pages/DashboardPage.js";
import { ModuleStubPage } from "../pages/ModuleStubPage.js";
import { PermissionsPage } from "../pages/PermissionsPage.js";
import { VitrineEditionPage } from "../pages/VitrineEditionPage.js";

const STUB_PATHS = [
  ...NAV_ITEMS.filter(
    (item) =>
      item.id !== "dashboard" &&
      item.id !== "administration" &&
      item.id !== "vitrine-edition" &&
      item.id !== "spaces" &&
      item.id !== "services" &&
      item.id !== "promo" &&
      item.id !== "billing" &&
      item.id !== "planning",
  ).map((item) => item.path),
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
                <Route path="/administration" element={<PermissionsPage />} />
                <Route path="/administration/vitrine" element={<VitrineEditionPage />} />
                <Route path="/spaces" element={<SpacesLayout />}>
                  <Route index element={<BuildingsPage />} />
                  <Route path=":buildingId" element={<BuildingDetailPage />} />
                </Route>
                <Route path="/services" element={<ServicesLayout />}>
                  <Route index element={<ServicesPage />} />
                </Route>
                <Route path="/promo" element={<PromoLayout />}>
                  <Route index element={<PromoCodesPage />} />
                </Route>
                <Route path="/billing" element={<BillingLayout />}>
                  <Route index element={<MarkTransferReceivedPage />} />
                  <Route path="quotes" element={<QuotesListPage />} />
                  <Route path="quotes/new" element={<QuoteWizardPage />} />
                  <Route path="quotes/:quoteId" element={<QuoteWizardPage />} />
                  <Route path="invoices" element={<InvoicesPlaceholderPage />} />
                </Route>
                <Route path="/planning" element={<PlanningLayout />}>
                  <Route index element={<PlanningPage />} />
                </Route>
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
