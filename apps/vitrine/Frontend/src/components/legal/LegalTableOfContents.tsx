"use client";

import Link from "next/link";
import { useState } from "react";

import styles from "./LegalTableOfContents.module.css";

export interface TocEntry {
  id: string;
  label: string;
}

interface LegalTableOfContentsProps {
  entries: TocEntry[];
}

export function LegalTableOfContents({ entries }: LegalTableOfContentsProps) {
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className={styles.nav} aria-label="Sommaire">
      <ol className={styles.list}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className={styles.link} onClick={() => setOpen(false)}>
              {entry.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );

  return (
    <>
      <aside className={styles.desktopToc}>{nav}</aside>
      <div className={styles.mobileToc}>
        <button
          type="button"
          className={styles.mobileTrigger}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          Sommaire
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        {open ? nav : null}
      </div>
    </>
  );
}

export function LegalCrossLinks({ currentPath }: { currentPath: string }) {
  const links = [
    { href: "/mentions-legales", label: "Mentions légales" },
    { href: "/politique-de-confidentialite", label: "Politique de confidentialité" },
    { href: "/cgv", label: "Conditions Générales de Vente" },
  ].filter((link) => link.href !== currentPath);

  return (
    <nav className={styles.crossLinks} aria-label="Autres pages légales">
      <p className={styles.crossLabel}>Documents légaux associés</p>
      <ul className={styles.crossList}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.crossLink}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function LegalPrintButton() {
  return (
    <button type="button" className={styles.printBtn} onClick={() => window.print()}>
      Imprimer / Télécharger en PDF
    </button>
  );
}
