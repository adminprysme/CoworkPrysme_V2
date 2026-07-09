import { MarqueeBanner } from "@/components/home/MarqueeBanner";
import { PageIntro } from "@/components/pages/PageIntro";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import { CONTACT_PAGE } from "@/config/contact-page";
import type { PublicBuildingInfo } from "@coworkprysme/shared";
import { DEFAULT_VITRINE_MARQUEE_TEXT } from "@coworkprysme/shared";
import { ContactMapBlock } from "./ContactMapBlock";
import { TransportIcon } from "./TransportIcon";
import styles from "./ContactPageContent.module.css";

interface ContactPageContentProps {
  building: PublicBuildingInfo;
}

export function ContactPageContent({ building }: ContactPageContentProps) {
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

      <Section muted>
        <Container>
          <ScrollReveal>
            <article className={styles.iconCard}>
              <div className={styles.iconWrap}>
                <TransportIcon type="parking" />
              </div>
              <div>
                <h2 className={styles.cardTitle}>{CONTACT_PAGE.parking.title}</h2>
                <p className={styles.cardText}>{CONTACT_PAGE.parking.places}</p>
                <p className={styles.cardHighlight}>{CONTACT_PAGE.parking.rate}</p>
              </div>
            </article>
          </ScrollReveal>
        </Container>
      </Section>

      <Section>
        <Container>
          <ScrollReveal>
            <SectionHeading title={CONTACT_PAGE.buildingAccess.title} />
            <ol className={styles.stepsList}>
              {CONTACT_PAGE.buildingAccess.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </ScrollReveal>
        </Container>
      </Section>

      <Section muted>
        <Container>
          <ScrollReveal>
            <SectionHeading title={CONTACT_PAGE.publicTransport.title} />
          </ScrollReveal>
          <ul className={styles.transportList}>
            {CONTACT_PAGE.publicTransport.lines.map((line, index) => (
              <ScrollReveal key={line.label} delay={index * 60}>
                <li className={styles.transportItem}>
                  <div className={styles.iconWrap}>
                    <TransportIcon type={line.icon} />
                  </div>
                  <div className={styles.transportBody}>
                    <h3 className={styles.transportLabel}>{line.label}</h3>
                    {line.href ? (
                      <a
                        href={line.href}
                        className={styles.transportLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {line.detail}
                      </a>
                    ) : (
                      <p className={styles.transportDetail}>{line.detail}</p>
                    )}
                    {line.note ? <span className={styles.transportBadge}>{line.note}</span> : null}
                  </div>
                </li>
              </ScrollReveal>
            ))}
          </ul>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className={styles.splitGrid}>
            <ScrollReveal>
              <article className={styles.iconCard}>
                <div className={styles.iconWrap}>
                  <TransportIcon type="bike" />
                </div>
                <div>
                  <h2 className={styles.cardTitle}>{CONTACT_PAGE.bikeWalk.title}</h2>
                  <p className={styles.cardText}>{CONTACT_PAGE.bikeWalk.description}</p>
                  <a
                    href={CONTACT_PAGE.bikeWalk.href}
                    className={styles.inlineLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {CONTACT_PAGE.bikeWalk.linkLabel}
                  </a>
                </div>
              </article>
            </ScrollReveal>

            <ScrollReveal delay={80}>
              <article className={styles.iconCard}>
                <div className={styles.iconWrap}>
                  <TransportIcon type="car" />
                </div>
                <div>
                  <h2 className={styles.cardTitle}>{CONTACT_PAGE.car.title}</h2>
                  <p className={styles.cardText}>{building.address.full}</p>
                  <p className={styles.cardText}>{CONTACT_PAGE.car.chargingNearby}</p>
                  <p className={styles.cardMuted}>{CONTACT_PAGE.car.onSiteCharging}</p>
                </div>
              </article>
            </ScrollReveal>
          </div>
        </Container>
      </Section>
    </>
  );
}
