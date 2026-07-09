import Link from "next/link";

import { AboutGroupAffiliation } from "@/components/about/AboutGroupAffiliation";
import { PageIntro } from "@/components/pages/PageIntro";
import { SeoLandingFooter } from "@/components/seo-landing/SeoLandingFooter";
import layout from "@/components/seo-landing/seo-landing-layouts.module.css";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import { ABOUT_PAGE } from "@/config/about-page";

import styles from "./AboutPageContent.module.css";

export function AboutPageContent() {
  const { vision, distinguishers, place, cta, relatedLinks } = ABOUT_PAGE;

  return (
    <>
      <PageIntro title={ABOUT_PAGE.title} subtitle={ABOUT_PAGE.subtitle} />

      <Section muted id="vision">
        <Container>
          <ScrollReveal>
            <div className={styles.visionBlock}>
              <SectionHeading eyebrow={vision.eyebrow} title={vision.title} />
              <p className={layout.bodyText}>{vision.body}</p>
            </div>
          </ScrollReveal>
        </Container>
      </Section>

      <Section id="distinguishers">
        <Container>
          <ScrollReveal>
            <SectionHeading
              eyebrow={distinguishers.eyebrow}
              title={distinguishers.title}
              lead={distinguishers.lead}
              centered
            />
          </ScrollReveal>

          <div className={styles.distinguishGrid}>
            {distinguishers.items.map((item, index) => (
              <ScrollReveal key={item.title} delay={index * 80}>
                <article className={styles.distinguishCard}>
                  <h3 className={styles.distinguishTitle}>{item.title}</h3>
                  <p className={styles.distinguishText}>{item.description}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </Section>

      <Section muted id="lieu">
        <Container>
          <div className={styles.placeGrid}>
            <ScrollReveal>
              <SectionHeading eyebrow={place.eyebrow} title={place.title} />
              <p className={layout.bodyText}>{place.body}</p>
              <p className={styles.address}>{place.address}</p>
              <p className={layout.bodyText}>
                <Link href="/contact">Contact & accès</Link> — plan, horaires et itinéraires
                détaillés.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className={styles.imagePlaceholder} aria-label={place.imageAlt}>
                <div className={styles.imagePlaceholderInner}>
                  <p className={styles.imagePlaceholderLabel}>{place.imageCaption}</p>
                  <p className={styles.imagePlaceholderText}>Bâtiment A1</p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </Container>
      </Section>

      <AboutGroupAffiliation />

      <SeoLandingFooter cta={cta} relatedLinks={[...relatedLinks]} />
    </>
  );
}
