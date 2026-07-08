import styles from "./SectionHeading.module.css";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  lead?: string;
  centered?: boolean;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  centered = false,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={[styles.header, centered ? styles.centered : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h2 className={styles.title}>{title}</h2>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
    </div>
  );
}

export function Section({
  children,
  muted = false,
  className,
  id,
}: {
  children: React.ReactNode;
  muted?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={[styles.section, muted ? styles.sectionMuted : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}
