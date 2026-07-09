import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import { HOME_CONTENT } from "@/config/home";
import type { HomePublicContent } from "@coworkprysme/shared";
import styles from "./ServicesPreviewSection.module.css";

interface ServicesPreviewSectionProps {
  serviceImages: HomePublicContent["serviceImages"];
}

const SERVICE_IMAGE_KEYS = ["roomService", "afterwork", "conciergerie"] as const;

export function ServicesPreviewSection({ serviceImages }: ServicesPreviewSectionProps) {
  const { services } = HOME_CONTENT;

  return (
    <Section>
      <Container>
        <ScrollReveal>
          <SectionHeading eyebrow={services.eyebrow} title={services.title} centered />
        </ScrollReveal>

        <div className={styles.grid}>
          {services.items.map((service, index) => {
            const imageKey = SERVICE_IMAGE_KEYS[index];
            const image = imageKey ? serviceImages[imageKey] : service.image;

            return (
              <ScrollReveal key={service.title} delay={index * 90}>
                <article className={styles.card}>
                  <div className={styles.imageWrap}>
                    <Image
                      src={image ?? service.image}
                      alt=""
                      fill
                      sizes="(max-width: 960px) 100vw, 33vw"
                      className={styles.image}
                    />
                  </div>
                  <div className={styles.body}>
                    <h3 className={styles.title}>{service.title}</h3>
                    <p className={styles.text}>{service.description}</p>
                    <Link href={service.href} className={styles.link}>
                      En savoir plus <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              </ScrollReveal>
            );
          })}
        </div>

        <div className={styles.footerCta}>
          <Button href="/services" variant="secondary" size="lg">
            Voir tous nos services
          </Button>
        </div>
      </Container>
    </Section>
  );
}
