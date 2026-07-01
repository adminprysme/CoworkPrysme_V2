import { useLocation } from "react-router-dom";

import { getNavItemByPath } from "../config/navigation.js";
import styles from "./ModuleStubPage.module.css";

const EXTRA_TITLES: Record<string, string> = {
  "/settings": "Paramètres",
};

export function ModuleStubPage() {
  const { pathname } = useLocation();
  const title = getNavItemByPath(pathname)?.label ?? EXTRA_TITLES[pathname] ?? "Module";

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.message}>Module à venir</p>
    </div>
  );
}
