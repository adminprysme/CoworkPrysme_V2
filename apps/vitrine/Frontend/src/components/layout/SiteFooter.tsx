import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/ui/Container";
import { FOOTER_NAV, SITE } from "@/config/site";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.top}>
          <div className={styles.brandBlock}>
            <Image
              src="/logo-cowork-prysme-full.png"
              alt=""
              width={180}
              height={44}
              className={styles.logo}
            />
            <p className={styles.tagline}>{SITE.tagline}</p>
          </div>

          <div>
            <h2 className={styles.columnTitle}>Découvrir</h2>
            <ul className={styles.links}>
              {FOOTER_NAV.discover.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={styles.link}>
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
                  <Link href={item.href} className={styles.link}>
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
                <a href={`mailto:${SITE.contact.email}`}>{SITE.contact.email}</a>
              </li>
              <li>
                <a href={SITE.contact.phoneHref}>{SITE.contact.phone}</a>
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
                <Link href={item.href} className={styles.link}>
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
