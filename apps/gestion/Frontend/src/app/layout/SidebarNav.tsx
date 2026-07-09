import { NavLink } from "react-router-dom";

import type { NavItem } from "../../config/navigation.js";
import {
  getNavItemEnd,
  getVisibleNavGroups,
  getVisibleStandaloneNavItems,
} from "../../config/navigation.js";
import { NavIcon } from "../../components/NavIcons.js";
import { useAuth } from "../AuthProvider.js";
import { useSidebar } from "./SidebarContext.js";
import styles from "./SidebarNav.module.css";

function NavItemLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <li>
      <NavLink
        to={item.path}
        end={getNavItemEnd(item)}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
        onClick={onNavigate}
      >
        <NavIcon id={item.id} className={styles.icon} />
        {!collapsed ? <span className={styles.label}>{item.label}</span> : null}
      </NavLink>
    </li>
  );
}

export function SidebarNav() {
  const { user } = useAuth();
  const { collapsed, closeMobile } = useSidebar();

  if (!user) {
    return null;
  }

  const standaloneItems = getVisibleStandaloneNavItems(user);
  const groups = getVisibleNavGroups(user);

  return (
    <nav className={styles.nav} aria-label="Navigation principale">
      {standaloneItems.length > 0 ? (
        <ul className={styles.list}>
          {standaloneItems.map((item) => (
            <NavItemLink key={item.id} item={item} collapsed={collapsed} onNavigate={closeMobile} />
          ))}
        </ul>
      ) : null}

      {groups.map((group) => (
        <section
          key={group.id}
          className={`${styles.group} ${styles.groupSeparated}`}
          aria-label={group.label}
        >
          {!collapsed ? <h2 className={styles.groupLabel}>{group.label}</h2> : null}
          <ul className={styles.list}>
            {group.items.map((item) => (
              <NavItemLink
                key={item.id}
                item={item}
                collapsed={collapsed}
                onNavigate={closeMobile}
              />
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
