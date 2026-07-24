import Image from "next/image";
import Link from "next/link";

import { PageIntro } from "@/components/pages/PageIntro";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import { SERVICES_PAGE } from "@/config/services-page";
import type { ServicesFeaturedSpace, VitrineServiceImages } from "@coworkprysme/shared";
import serviceCardStyles from "@/components/home/ServicesPreviewSection.module.css";
import styles from "./ServicesPageContent.module.css";

const SERVICE_IMAGE_KEYS = ["roomService", "afterwork", "conciergerie"] as const;

interface ServicesPageContentProps {
  serviceImages: VitrineServiceImages;
  featuredSpaces: ServicesFeaturedSpace[];
}

export function ServicesPageContent({ serviceImages, featuredSpaces }: ServicesPageContentProps) {
  const { services, spacesPreview } = SERVICES_PAGE;

  return (
    <>
      <PageIntro title={SERVICES_PAGE.title} subtitle={SERVICES_PAGE.subtitle} />

      <Section>
        <Container>
          <div className={serviceCardStyles.grid}>
            {services.map((service, index) => {
              const imageKey = SERVICE_IMAGE_KEYS[index];
              const image = imageKey ? serviceImages[imageKey] : service.imageFallback;

              return (
                <ScrollReveal key={service.id} delay={index * 80}>
                  <article className={serviceCardStyles.card}>
                    <div className={serviceCardStyles.imageWrap}>
                      <Image
                        src={image ?? service.imageFallback}
                        alt=""
                        fill
                        sizes="(max-width: 960px) 100vw, 33vw"
                        className={serviceCardStyles.image}
                      />
                    </div>
                    <div className={serviceCardStyles.body}>
                      <h2 className={serviceCardStyles.title}>{service.title}</h2>
                      <p className={serviceCardStyles.text}>{service.description}</p>
                    </div>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        </Container>
      </Section>

      {featuredSpaces.length > 0 ? (
        <Section muted>
          <Container>
            <ScrollReveal>
              <SectionHeading
                eyebrow={spacesPreview.eyebrow}
                title={spacesPreview.title}
                lead={spacesPreview.lead}
                centered
              />
            </ScrollReveal>

            <div className={styles.spaceGrid}>
              {featuredSpaces.map((space, index) => (
                <ScrollReveal key={space.id} delay={index * 90}>
                  <article className={styles.spaceCard}>
                    <div className={styles.spaceImageWrap}>
                      <Image
                        src={space.image}
                        alt=""
                        fill
                        sizes="(max-width: 960px) 100vw, 33vw"
                        className={styles.spaceImage}
                      />
                      <span className={styles.capacityBadge}>{space.capacity} pers. max</span>
                    </div>
                    <div className={styles.spaceBody}>
                      <p className={styles.spaceType}>
                        {space.type === "private_office" ? "Bureau privatif" : "Salle de réunion"}
                      </p>
                      <h3 className={styles.spaceTitle}>{space.name}</h3>
                      <p className={styles.spaceText}>{space.description}</p>
                      <ul className={styles.equipmentList}>
                        {space.equipment.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      <Link href={space.href} className={styles.spaceLink}>
                        Voir les {space.type === "private_office" ? "bureaux" : "salles"}{" "}
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
