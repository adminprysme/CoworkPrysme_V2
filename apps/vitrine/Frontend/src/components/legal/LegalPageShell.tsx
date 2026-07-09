import type { ReactNode } from "react";

import { Container } from "@/components/ui/Container";
import { formatLegalLastUpdated } from "@/config/legal/meta";

import {
  LegalCrossLinks,
  LegalPrintButton,
  LegalTableOfContents,
  type TocEntry,
} from "./LegalTableOfContents";
import styles from "./LegalPageShell.module.css";

interface LegalPageShellProps {
  title: string;
  path: string;
  toc: TocEntry[];
  children: ReactNode;
}

export function LegalPageShell({ title, path, toc, children }: LegalPageShellProps) {
  return (
    <div className={styles.page}>
      <Container>
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <p className={styles.eyebrow}>Document légal</p>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.updated}>Dernière mise à jour : {formatLegalLastUpdated()}</p>
          </div>
          <LegalPrintButton />
        </header>

        <div className={styles.layout}>
          <LegalTableOfContents entries={toc} />
          <article className={styles.content}>{children}</article>
        </div>

        <LegalCrossLinks currentPath={path} />
      </Container>
    </div>
  );
}
