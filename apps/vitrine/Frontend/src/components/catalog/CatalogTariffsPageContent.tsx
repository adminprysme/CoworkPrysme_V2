import type { CatalogTariffsContent } from "@coworkprysme/shared";
import { formatCentsAsEuroString } from "@coworkprysme/shared";
import Image from "next/image";
import Link from "next/link";

import type { CatalogPageConfig } from "@/config/catalog-pages";
import { SITE } from "@/config/site";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

import { CatalogBuildingSelector } from "./CatalogBuildingSelector";
import styles from "./catalog.module.css";

interface CatalogTariffsPageContentProps {
  config: CatalogPageConfig;
  content: CatalogTariffsContent;
}

const SPACE_TYPE_LABEL = {
  private_office: "Bureau privatif",
  meeting_room: "Salle de réunion",
} as const;

export function CatalogTariffsPageContent({ config, content }: CatalogTariffsPageContentProps) {
  const { building, groups, visibleBuildings } = content;
  const heroImage = building.primaryPhotoUrl ?? SITE.social.ogImage;
  const intro = building.description?.trim() || config.introFallback;

  return (
    <section className={styles.catalogSection}>
      <Container>
        <CatalogBuildingSelector
          buildings={visibleBuildings}
          currentSlug={building.slug}
          basePath={config.basePath}
        />

        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{config.heroEyebrow}</p>
            <h1 className={styles.title}>Tarifs — {building.name}</h1>
            <p className={styles.lead}>{building.tagline ?? intro}</p>
          </div>

          <div className={styles.heroImageWrap}>
            <Image
              src={heroImage}
              alt={`${building.name} — ${building.city}`}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 45vw"
              className={styles.heroImage}
            />
          </div>
        </div>

        <p className={styles.intro}>{intro}</p>

        {groups.length === 0 || groups.every((group) => group.lines.length === 0) ? (
          <div className={styles.emptyState}>
            <p>{config.emptyMessage}</p>
          </div>
        ) : (
          <div className={styles.tariffsTableWrap}>
            <table className={styles.tariffsTable}>
              <thead>
                <tr>
                  <th scope="col">Espace</th>
                  <th scope="col">Type</th>
                  <th scope="col">Durée</th>
                  <th scope="col">Prix HT</th>
                  <th scope="col">TVA</th>
                </tr>
              </thead>
              <tbody>
                {groups.flatMap((group) =>
                  group.lines.map((line) => (
                    <tr key={`${group.spaceId}-${line.durationClass}`}>
                      <td>{group.spaceName}</td>
                      <td>{SPACE_TYPE_LABEL[group.type]}</td>
                      <td>{line.label}</td>
                      <td>{formatCentsAsEuroString(line.priceHTCents)} €</td>
                      <td>{line.vatRate} %</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className={styles.legalNote}>Tarifs HT, TVA applicable indiquée.</p>

        <div className={styles.cardActions}>
          <Button href="/reservation">Réserver</Button>
          <Button href="/contact" variant="secondary">
            Demander un devis
          </Button>
        </div>

        <div className={styles.footerLinks}>
          {config.relatedLinks.map((link) => (
            <Link key={link.href} href={link.href} className={styles.footerLink}>
              {link.label} →
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
