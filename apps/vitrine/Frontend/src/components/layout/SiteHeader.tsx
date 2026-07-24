"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { NavLink } from "@/components/ui/NavLink";
import { Container } from "@/components/ui/Container";
import { CLIENT_PORTAL_URL, MAIN_NAV } from "@/config/site";
import { isNavItemActive, resolveNavHref } from "@/lib/catalog-nav";

import { NavigationProgress } from "./NavigationProgress";
import styles from "./SiteHeader.module.css";

interface SiteHeaderProps {
  defaultBuildingSlug?: string | null;
}

export function SiteHeader({ defaultBuildingSlug = null }: SiteHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const navItems = MAIN_NAV.map((item) => ({
    ...item,
    href: resolveNavHref(item.href, defaultBuildingSlug),
  }));

  return (
    <header className={styles.header}>
      <NavigationProgress />

      <Container className={styles.headerContainer}>
        <div className={styles.inner}>
          <Link href="/" className={styles.logoLink} aria-label="Cowork Prysme — Accueil">
            <Image
              src="/logo-cowork-prysme-full.png"
              alt="CoWork Prysme"
              width={210}
              height={48}
              className={styles.logoImage}
              priority
            />
          </Link>

          <nav className={styles.navDesktop} aria-label="Navigation principale">
            {navItems.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={styles.navLink}
                  activeClassName={styles.navLinkActive}
                  pendingClassName={styles.navLinkPending}
                  isActive={active}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className={styles.actions}>
            <Button
              href={CLIENT_PORTAL_URL}
              variant="ghost"
              size="sm"
              className={styles.actionButton}
            >
              Se connecter
            </Button>
            <Button href="/reservation" variant="primary" size="sm" className={styles.actionButton}>
              Réserver
            </Button>
          </div>

          <button
            type="button"
            className={[styles.menuToggle, menuOpen ? styles.menuOpen : ""]
              .filter(Boolean)
              .join(" ")}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={styles.menuToggleLines} />
          </button>
        </div>
      </Container>

      <div
        id="mobile-navigation"
        className={[styles.mobilePanel, menuOpen ? styles.mobilePanelOpen : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <nav className={styles.mobileNav} aria-label="Navigation mobile">
          {navItems.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <NavLink
                key={item.href}
                href={item.href}
                prefetch
                className={styles.mobileNavLink}
                activeClassName={styles.mobileNavLinkActive}
                pendingClassName={styles.mobileNavLinkPending}
                isActive={active}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className={styles.mobileActions}>
          <Button href={CLIENT_PORTAL_URL} variant="secondary" fullWidth>
            Créer un compte / Se connecter
          </Button>
          <Button href="/reservation" variant="primary" fullWidth>
            Réserver
          </Button>
        </div>
      </div>
    </header>
  );
}
