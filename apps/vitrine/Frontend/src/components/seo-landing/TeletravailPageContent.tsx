import Image from "next/image";

import { PageIntro } from "@/components/pages/PageIntro";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import type { SeoLandingPageConfig } from "@/config/seo-landing-pages";

import { LocalBusinessJsonLd } from "./LocalBusinessJsonLd";
import { SeoLandingFooter } from "./SeoLandingFooter";
import layout from "./seo-landing-layouts.module.css";
import styles from "./TeletravailPageContent.module.css";

const IMAGE = "/images/seo/bureau-teletravail.jpg";
const IMAGE_ALT = "Professionnel au téléphone dans un espace de travail — CoworkPrysme, Lyon 7";
const IMAGE_WIDTH = 681;
const IMAGE_HEIGHT = 1024;

interface Props {
  page: SeoLandingPageConfig;
}

export function TeletravailPageContent({ page }: Props) {
  const [changes, access] = page.sections;

  return (
    <>
      <LocalBusinessJsonLd />
      <PageIntro title={page.h1} subtitle={page.intro} />

      <Section>
        <Container>
          <div className={styles.heroSplit}>
            <ScrollReveal>
              <figure className={styles.photoFrame}>
                <Image
                  src={IMAGE}
                  alt={IMAGE_ALT}
                  width={IMAGE_WIDTH}
                  height={IMAGE_HEIGHT}
                  className={styles.photo}
                  sizes="(max-width: 900px) min(100vw, 20rem), 22rem"
                  priority
                />
              </figure>
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <div className={styles.textCol}>
                <SectionHeading title={changes.title} />
                <p className={layout.bodyText}>{changes.body}</p>
              </div>
            </ScrollReveal>
          </div>
        </Container>
      </Section>

      <Section muted>
        <Container>
          <ScrollReveal>
            <SectionHeading title={access.title} />
            <p className={layout.bodyText}>{access.body}</p>
          </ScrollReveal>
        </Container>
      </Section>

      <SeoLandingFooter cta={page.cta} relatedLinks={page.relatedLinks} />
    </>
  );
}
