import Image from "next/image";

import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import { HOME_CONTENT } from "@/config/home";
import styles from "./ConceptSection.module.css";

interface ConceptSectionProps {
  conceptImage: string;
}

export function ConceptSection({ conceptImage }: ConceptSectionProps) {
  const { concept } = HOME_CONTENT;

  return (
    <Section>
      <Container>
        <ScrollReveal>
          <div className={styles.grid}>
            <div className={styles.copy}>
              <SectionHeading eyebrow={concept.eyebrow} title={concept.title} />
              <p className={styles.body}>{concept.body}</p>
            </div>
            <div className={styles.visual}>
              <div className={styles.accent} aria-hidden="true" />
              <Image
                src={conceptImage}
                alt="Espace de coworking lumineux et chaleureux"
                fill
                sizes="(max-width: 900px) 100vw, 45vw"
                className={styles.image}
              />
            </div>
          </div>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
