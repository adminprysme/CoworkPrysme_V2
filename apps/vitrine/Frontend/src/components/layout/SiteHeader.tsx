"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { CLIENT_PORTAL_URL, MAIN_NAV } from "@/config/site";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
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

  return (
    <header className={styles.header}>
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
            {MAIN_NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[styles.navLink, active ? styles.navLinkActive : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {item.label}
                </Link>
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
            <Button href="/contact" variant="primary" size="sm" className={styles.actionButton}>
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
          {MAIN_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={styles.mobileNavLink}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.mobileActions}>
          <Button href={CLIENT_PORTAL_URL} variant="secondary" fullWidth>
            Créer un compte / Se connecter
          </Button>
          <Button href="/contact" variant="primary" fullWidth>
            Réserver
          </Button>
        </div>
      </div>
    </header>
  );
}
