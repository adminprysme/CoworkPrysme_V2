import type { ReactNode } from "react";

import styles from "./LegalSection.module.css";

interface LegalSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

interface LegalSubSectionProps {
  title: string;
  children: ReactNode;
}

export function LegalSubSection({ title, children }: LegalSubSectionProps) {
  return (
    <div className={styles.subSection}>
      <h3 className={styles.subTitle}>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className={styles.paragraph}>{children}</p>;
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalDefinitionList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className={styles.definitionList}>
      {items.map(([term, value]) => (
        <div key={term} className={styles.definitionRow}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
