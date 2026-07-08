import Image from "next/image";

import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import { HOME_CONTENT } from "@/config/home";
import styles from "./ConceptSection.module.css";

const CONCEPT_IMAGE =
  "https://images.unsplash.com/photo-1497215728101-856f4fd90354?auto=format&fit=crop&w=1200&q=80";

export function ConceptSection() {
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
                src={CONCEPT_IMAGE}
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
