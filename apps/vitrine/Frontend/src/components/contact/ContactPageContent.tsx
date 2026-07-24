import { MarqueeBanner } from "@/components/home/MarqueeBanner";
import { PageIntro } from "@/components/pages/PageIntro";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import { CONTACT_PAGE } from "@/config/contact-page";
import type { PublicBuildingInfo } from "@coworkprysme/shared";
import { DEFAULT_VITRINE_MARQUEE_TEXT, buildGoogleMapsDirectionsUrl } from "@coworkprysme/shared";
import { ContactDirectionsPanel } from "./ContactDirectionsPanel";
import { ContactMapBlock } from "./ContactMapBlock";
import styles from "./ContactPageContent.module.css";

interface ContactPageContentProps {
  building: PublicBuildingInfo;
}

export function ContactPageContent({ building }: ContactPageContentProps) {
  const directionsUrl = buildGoogleMapsDirectionsUrl({
    lat: building.coordinates.lat,
    lng: building.coordinates.lng,
    address: building.address.full,
  });

  return (
    <>
      <PageIntro title={CONTACT_PAGE.title} />

      <MarqueeBanner enabled text={DEFAULT_VITRINE_MARQUEE_TEXT} />

      <Section>
        <Container>
          <div className={styles.topGrid}>
            <ScrollReveal>
              <div className={styles.infoBlock}>
                <SectionHeading title="Coordonnées" />
                <dl className={styles.detailsList}>
                  <div>
                    <dt>Adresse</dt>
                    <dd>
                      {building.name}
                      <br />
                      {building.address.street}
                      {building.address.accessInfo ? (
                        <>
                          <br />
                          {building.address.accessInfo}
                        </>
                      ) : null}
                      <br />
                      {building.address.postalCode} {building.address.city}
                    </dd>
                  </div>
                  <div>
                    <dt>Téléphone</dt>
                    <dd>
                      {building.phoneHref && building.phone ? (
                        <a href={building.phoneHref}>{building.phone}</a>
                      ) : (
                        building.phone
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>E-mail</dt>
                    <dd>
                      {building.email ? (
                        <a href={`mailto:${building.email}`}>{building.email}</a>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={80}>
              <div className={styles.mapBlock}>
                <h2 className={styles.mapTitle}>{CONTACT_PAGE.map.title}</h2>
                <ContactMapBlock
                  lat={building.coordinates.lat}
                  lng={building.coordinates.lng}
                  name={building.name}
                />
                <a
                  href={building.mapExternalUrl}
                  className={styles.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {CONTACT_PAGE.map.openLabel}
                </a>
              </div>
            </ScrollReveal>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <ScrollReveal>
            <article className={styles.accessPanel}>
              <SectionHeading
                eyebrow={CONTACT_PAGE.buildingAccess.eyebrow}
                title={CONTACT_PAGE.buildingAccess.title}
                className={styles.accessHeading}
              />
              <ol className={styles.accessSteps}>
                {CONTACT_PAGE.buildingAccess.steps.map((step, index) => (
                  <li key={step.label} className={styles.accessStep}>
                    <div className={styles.accessStepMeta}>
                      <span className={styles.accessStepNumber} aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className={styles.accessStepLabel}>{step.label}</h3>
                    </div>
                    <p className={styles.accessStepText}>
                      {step.description}
                      {step.highlight ? (
                        <>
                          {" "}
                          <span className={styles.accessHighlight}>{step.highlight}</span>
                          {"."}
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ol>
            </article>
          </ScrollReveal>
        </Container>
      </Section>

      <Section muted>
        <Container>
          <ScrollReveal>
            <ContactDirectionsPanel address={building.address.full} directionsUrl={directionsUrl} />
          </ScrollReveal>
        </Container>
      </Section>
    </>
  );
}
