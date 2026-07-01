import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../AuthProvider.js";
import { useSidebar } from "./SidebarContext.js";
import { ChevronDownIcon } from "../../components/NavIcons.js";
import { ThemeToggleSwitch } from "../../components/ThemeToggleSwitch.js";
import { logout } from "../../lib/api.js";
import styles from "./UserMenu.module.css";

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const { user, setUser } = useAuth();
  const { collapsed } = useSidebar();
  const navigate = useNavigate();
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!user) {
    return null;
  }

  const photo = user.enrichment?.photo;
  const position = user.enrichment?.position ?? "—";
  const displayName = user.profile.displayName;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { redirectUrl } = await logout();
      setUser(null);
      if (redirectUrl.startsWith("http://") || redirectUrl.startsWith("https://")) {
        window.location.href = redirectUrl;
      } else {
        navigate(redirectUrl, { replace: true });
      }
    } catch {
      setUser(null);
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <button
        type="button"
        className={[styles.trigger, collapsed ? styles.triggerCollapsed : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        {photo ? (
          <img src={photo} alt="" className={styles.avatar} />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {getInitials(displayName)}
          </span>
        )}
        {!collapsed ? (
          <>
            <span className={styles.identity}>
              <span className={styles.name}>{displayName}</span>
              <span className={styles.position}>{position}</span>
            </span>
            <ChevronDownIcon className={styles.chevron} />
          </>
        ) : null}
      </button>

      {open ? (
        <div id={menuId} className={styles.dropdown} role="menu">
          <div className={styles.themeRow} role="none">
            <ThemeToggleSwitch />
          </div>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            role="menuitem"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
          >
            {loggingOut ? "Déconnexion…" : "Déconnexion"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
