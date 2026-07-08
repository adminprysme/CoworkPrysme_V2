import type { ReactNode } from "react";

import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import { HOME_CONTENT } from "@/config/home";
import styles from "./AudienceSection.module.css";

function ProfileIcon({ type }: { type: string }) {
  const paths: Record<string, ReactNode> = {
    user: (
      <path
        d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4Z"
        fill="currentColor"
      />
    ),
    rocket: (
      <path
        d="M12 3c3 2 5 5 5 9 0 2-.5 3.5-1.5 5L12 14l-3.5 3C7.5 15.5 7 14 7 12c0-4 2-7 5-9Zm0 11 2.2 2.2a6 6 0 0 0 1.3-1.8H12v-0.4Z"
        fill="currentColor"
      />
    ),
    laptop: (
      <path
        d="M5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6H5V7Zm-1 8h16l1.5 2H2.5L4 15Z"
        fill="currentColor"
      />
    ),
    building: <path d="M10 3h4v18h-4V3Zm-6 6h4v12H4V9Zm12 4h4v8h-4v-8Z" fill="currentColor" />,
    lightbulb: (
      <path
        d="M12 3a5 5 0 0 0-3 9.1V14h6v-1.9A5 5 0 0 0 12 3Zm-2 13h4v2h-4v-2Z"
        fill="currentColor"
      />
    ),
  };

  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {paths[type] ?? paths.user}
    </svg>
  );
}

export function AudienceSection() {
  const { audiences } = HOME_CONTENT;

  return (
    <Section muted>
      <Container>
        <ScrollReveal>
          <SectionHeading eyebrow={audiences.eyebrow} title={audiences.title} centered />
        </ScrollReveal>

        <div className={styles.layout}>
          <div className={styles.profileGrid}>
            {audiences.profiles.map((profile, index) => (
              <ScrollReveal key={profile.title} delay={index * 80}>
                <article
                  className={[styles.card, index === 4 ? styles.cardWide : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className={styles.iconWrap}>
                    <ProfileIcon type={profile.icon} />
                  </div>
                  <h3 className={styles.cardTitle}>{profile.title}</h3>
                  <p className={styles.cardText}>{profile.description}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={120}>
            <aside className={styles.reasons}>
              <h3 className={styles.reasonsTitle}>{audiences.reasons.title}</h3>
              <ul className={styles.reasonList}>
                {audiences.reasons.items.map((item) => (
                  <li key={item.title} className={styles.reasonItem}>
                    <p className={styles.reasonName}>{item.title}</p>
                    <p className={styles.reasonText}>{item.description}</p>
                  </li>
                ))}
              </ul>
            </aside>
          </ScrollReveal>
        </div>
      </Container>
    </Section>
  );
}
