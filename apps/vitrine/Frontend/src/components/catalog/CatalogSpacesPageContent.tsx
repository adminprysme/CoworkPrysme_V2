import type { CatalogBuildingDetail, CatalogSpaceCard } from "@coworkprysme/shared";
import { formatCentsAsEuroString } from "@coworkprysme/shared";
import Image from "next/image";
import Link from "next/link";

import type { CatalogPageConfig } from "@/config/catalog-pages";
import { SITE } from "@/config/site";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

import { CatalogBuildingSelector } from "./CatalogBuildingSelector";
import { CatalogJsonLd } from "./CatalogJsonLd";
import styles from "./catalog.module.css";

interface CatalogSpacesPageContentProps {
  config: CatalogPageConfig;
  building: CatalogBuildingDetail;
  spaces: CatalogSpaceCard[];
  visibleBuildings: Array<
    Pick<
      CatalogBuildingDetail,
      "id" | "slug" | "name" | "city" | "tagline" | "primaryPhotoUrl" | "isDefault"
    >
  >;
}

export function CatalogSpacesPageContent({
  config,
  building,
  spaces,
  visibleBuildings,
}: CatalogSpacesPageContentProps) {
  const intro = building.description?.trim() || config.introFallback;
  const heroImage = building.primaryPhotoUrl ?? SITE.social.ogImage;

  return (
    <>
      <CatalogJsonLd
        building={building}
        spaces={spaces}
        pagePath={`${config.basePath}/${building.slug}`}
      />

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
              <h1 className={styles.title}>{building.name}</h1>
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

          {spaces.length === 0 ? (
            <div className={styles.emptyState}>
              <p>{config.emptyMessage}</p>
              <p>
                <Link href="/contact">Contactez-nous</Link>
              </p>
            </div>
          ) : (
            <div className={styles.grid}>
              {spaces.map((space) => (
                <article key={space.id} className={styles.card}>
                  <div className={styles.cardImageWrap}>
                    {space.primaryPhotoUrl ? (
                      <Image
                        src={space.primaryPhotoUrl}
                        alt={space.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw"
                        className={styles.cardImage}
                        loading="lazy"
                      />
                    ) : (
                      <div className={styles.cardImagePlaceholder}>Photo à venir</div>
                    )}
                  </div>

                  <div className={styles.cardBody}>
                    <h2 className={styles.cardTitle}>{space.name}</h2>
                    <p className={styles.cardMeta}>Capacité : {space.capacity} personnes</p>
                    {space.equipments.length > 0 ? (
                      <p className={styles.cardEquipments}>{space.equipments.join(" · ")}</p>
                    ) : null}
                    {space.startingPriceHTCents !== null ? (
                      <>
                        <p className={styles.price}>
                          À partir de {formatCentsAsEuroString(space.startingPriceHTCents)} € HT
                        </p>
                        {space.startingPriceVatRate !== null ? (
                          <p className={styles.priceNote}>TVA {space.startingPriceVatRate} %</p>
                        ) : null}
                      </>
                    ) : (
                      <p className={styles.priceNote}>Tarif sur demande</p>
                    )}

                    <div className={styles.cardActions}>
                      <Button href="/reservation" size="sm">
                        Réserver
                      </Button>
                      <Button href="/contact" variant="secondary" size="sm">
                        Demander un devis
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className={styles.footerLinks}>
            <Link href={`/tarifs/${building.slug}`} className={styles.footerLink}>
              Voir tous les tarifs →
            </Link>
            {config.relatedLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.footerLink}>
                {link.label} →
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
