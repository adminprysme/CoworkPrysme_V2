import { Outlet } from "react-router-dom";

import { SidebarProvider, useSidebar } from "./SidebarContext.js";
import { SidebarNav } from "./SidebarNav.js";
import { UserMenu } from "./UserMenu.js";
import { CollapseIcon, MenuIcon } from "../../components/NavIcons.js";
import styles from "./AppShell.module.css";

function AppShellContent() {
  const { collapsed, mobileOpen, toggleCollapsed, openMobile, closeMobile } = useSidebar();

  return (
    <div className={styles.shell}>
      {mobileOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Fermer le menu"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        className={[
          styles.sidebar,
          collapsed ? styles.collapsed : "",
          mobileOpen ? styles.mobileOpen : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.zoneA}>
          <div className={styles.brand}>
            <img src="/logo-icon.png" alt="" className={styles.logoIcon} />
            {!collapsed ? <span className={styles.appName}>Gestion</span> : null}
          </div>
        </div>

        <div className={styles.zoneB}>
          <UserMenu />
        </div>

        <div className={styles.zoneC}>
          <SidebarNav />
        </div>

        <div className={styles.zoneD}>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Développer la sidebar" : "Réduire la sidebar"}
          >
            <CollapseIcon className={styles.collapseIcon} />
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.mobileHeader}>
          <button
            type="button"
            className={styles.burgerBtn}
            aria-label="Ouvrir le menu"
            onClick={openMobile}
          >
            <MenuIcon />
          </button>
          <span className={styles.mobileTitle}>Cowork Prysme</span>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <SidebarProvider>
      <AppShellContent />
    </SidebarProvider>
  );
}
