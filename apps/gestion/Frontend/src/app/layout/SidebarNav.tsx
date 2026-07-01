import { NavLink } from "react-router-dom";

import { useAuth } from "../AuthProvider.js";
import { NAV_ITEMS, isNavItemVisible } from "../../config/navigation.js";
import { NavIcon } from "../../components/NavIcons.js";
import { useSidebar } from "./SidebarContext.js";
import styles from "./SidebarNav.module.css";

export function SidebarNav() {
  const { user } = useAuth();
  const { collapsed, closeMobile } = useSidebar();

  if (!user) {
    return null;
  }

  const visibleItems = NAV_ITEMS.filter((item) => isNavItemVisible(item, user));

  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      <ul className={styles.list}>
        {visibleItems.map((item) => (
          <li key={item.id}>
            <NavLink
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.active}` : styles.link
              }
              onClick={closeMobile}
            >
              <NavIcon id={item.id} className={styles.icon} />
              {!collapsed ? <span className={styles.label}>{item.label}</span> : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
