import Image from "next/image";
import Link from "next/link";

import type { SiteContact } from "@coworkprysme/shared";

import { Container } from "@/components/ui/Container";
import { FOOTER_NAV, SITE } from "@/config/site";
import { resolveNavHref } from "@/lib/catalog-nav";

import styles from "./SiteFooter.module.css";

interface SiteFooterProps {
  contact: SiteContact;
  defaultBuildingSlug?: string | null;
}

export function SiteFooter({ contact, defaultBuildingSlug = null }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const discoverLinks = FOOTER_NAV.discover.map((item) => ({
    ...item,
    href: resolveNavHref(item.href, defaultBuildingSlug),
  }));

  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.top}>
          <div className={styles.brandBlock}>
            <Link href="/" className={styles.logoLink} aria-label="Cowork Prysme — Accueil">
              <Image
                src="/logo-cowork-prysme.png"
                alt="Cowork Prysme"
                width={1000}
                height={500}
                className={styles.logo}
              />
            </Link>
            <p className={styles.tagline}>{SITE.tagline}</p>
          </div>

          <div>
            <h2 className={styles.columnTitle}>Découvrir</h2>
            <ul className={styles.links}>
              {discoverLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} prefetch className={styles.link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className={styles.columnTitle}>Cowork Prysme</h2>
            <ul className={styles.links}>
              {FOOTER_NAV.company.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} prefetch className={styles.link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className={styles.columnTitle}>Contact</h2>
            <ul className={styles.contactList}>
              <li>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
              <li>
                <a href={contact.phoneHref ?? `tel:${contact.phone}`}>{contact.phone}</a>
              </li>
              <li>
                {SITE.contact.addressLine1}
                <br />
                {SITE.contact.addressLine2}
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <p>
            © {year} {SITE.legalName}. Tous droits réservés.{" "}
            {FOOTER_NAV.legal.map((item, index) => (
              <span key={item.href}>
                {index > 0 ? " · " : ""}
                <Link href={item.href} prefetch className={styles.link}>
                  {item.label}
                </Link>
              </span>
            ))}
          </p>
        </div>
      </Container>
    </footer>
  );
}
