import { ABOUT_PAGE } from "@/config/about-page";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

import styles from "./AboutGroupAffiliation.module.css";

export function AboutGroupAffiliation() {
  const { groupAffiliation } = ABOUT_PAGE;

  return (
    <section className={styles.section} aria-labelledby="about-group-affiliation-title">
      <Container>
        <ScrollReveal>
          <aside className={styles.card}>
            <h2 id="about-group-affiliation-title" className={styles.title}>
              {groupAffiliation.title}
            </h2>
            <p className={styles.body}>{groupAffiliation.body}</p>
            <a
              href={groupAffiliation.link.href}
              className={styles.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {groupAffiliation.link.label}
              <span aria-hidden="true">→</span>
              <span className="sr-only"> (ouvre dans un nouvel onglet)</span>
            </a>
          </aside>
        </ScrollReveal>
      </Container>
    </section>
  );
}
