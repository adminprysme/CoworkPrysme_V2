import { useId, useState, type ReactNode } from "react";

import styles from "./VitrineCollapsibleSection.module.css";

interface VitrineCollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function VitrineCollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: VitrineCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.title}>{title}</span>
        <span className={styles.icon} aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <div id={panelId} className={styles.body}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
