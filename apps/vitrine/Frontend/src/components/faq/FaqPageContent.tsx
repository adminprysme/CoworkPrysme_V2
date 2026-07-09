import Link from "next/link";

import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { FaqJsonLd } from "@/components/faq/FaqJsonLd";
import { PageIntro } from "@/components/pages/PageIntro";
import { SeoLandingFooter } from "@/components/seo-landing/SeoLandingFooter";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section } from "@/components/ui/SectionHeading";
import { FAQ_PAGE } from "@/config/faq-page";

import styles from "./FaqPageContent.module.css";

export function FaqPageContent() {
  const groups = FAQ_PAGE.groups.map((group) => ({
    id: group.id,
    title: group.title,
    items: group.items.map((item) => ({
      ...item,
      links: item.links ? [...item.links] : undefined,
    })),
  }));

  return (
    <>
      <FaqJsonLd />
      <PageIntro title={FAQ_PAGE.title} subtitle={FAQ_PAGE.subtitle} />

      <Section>
        <Container>
          <ScrollReveal>
            <nav className={styles.themeNav} aria-label="Thèmes de la FAQ">
              {FAQ_PAGE.groups.map((group) => (
                <Link key={group.id} href={`#${group.id}`} className={styles.themeLink}>
                  {group.title}
                </Link>
              ))}
            </nav>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <FaqAccordion groups={groups} />
          </ScrollReveal>
        </Container>
      </Section>

      <SeoLandingFooter cta={FAQ_PAGE.cta} relatedLinks={[...FAQ_PAGE.relatedLinks]} />
    </>
  );
}
