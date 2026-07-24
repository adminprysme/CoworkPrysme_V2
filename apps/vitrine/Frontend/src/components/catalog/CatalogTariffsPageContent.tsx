import type {
  CatalogTariffSpaceGroup,
  CatalogTariffsContent,
  SpaceType,
} from "@coworkprysme/shared";
import Image from "next/image";
import Link from "next/link";

import type { CatalogPageConfig } from "@/config/catalog-pages";
import { SITE } from "@/config/site";
import { resolveRelatedLinkHref } from "@/lib/catalog-nav";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

import { CatalogBuildingSelector } from "./CatalogBuildingSelector";
import { CatalogTariffSpaceAccordion } from "./CatalogTariffSpaceAccordion";
import styles from "./catalog.module.css";

interface CatalogTariffsPageContentProps {
  config: CatalogPageConfig;
  content: CatalogTariffsContent;
}

const TARIFF_COLUMNS: Array<{
  type: SpaceType;
  title: string;
  emptyMessage: string;
}> = [
  {
    type: "private_office",
    title: "Bureaux privatifs",
    emptyMessage: "Aucun bureau privatif disponible pour le moment.",
  },
  {
    type: "meeting_room",
    title: "Salles de réunion",
    emptyMessage: "Aucune salle de réunion disponible pour le moment.",
  },
];

function groupsForType(
  groups: CatalogTariffSpaceGroup[],
  type: SpaceType,
): CatalogTariffSpaceGroup[] {
  return groups.filter((group) => group.type === type);
}

interface TariffColumnProps {
  title: string;
  emptyMessage: string;
  groups: CatalogTariffSpaceGroup[];
}

function TariffColumn({
  title,
  emptyMessage,
  groups,
  columnId,
}: TariffColumnProps & { columnId: string }) {
  return (
    <section className={styles.tariffsColumn} aria-labelledby={columnId}>
      <h2 id={columnId} className={styles.tariffsColumnTitle}>
        {title}
      </h2>

      {groups.length === 0 ? (
        <div className={styles.tariffsColumnEmpty}>
          <p>{emptyMessage}</p>
          <Link href="/reservation" className={styles.tariffsColumnEmptyLink}>
            Voir toutes les salles en réservation →
          </Link>
          <Link href="/contact" className={styles.tariffsColumnEmptyLinkSecondary}>
            Nous contacter
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.tariffsColumnCards}>
            {groups.map((group, index) => (
              <CatalogTariffSpaceAccordion
                key={group.spaceId}
                group={group}
                defaultOpen={index === 0}
              />
            ))}
          </div>
          <p className={styles.tariffsColumnFootnote}>
            <Link href="/reservation" className={styles.tariffsReservationLink}>
              Voir tous les espaces et tarifs en réservation →
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

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

        <div className={styles.tariffsColumns}>
          {TARIFF_COLUMNS.map((column) => (
            <TariffColumn
              key={column.type}
              columnId={`tariffs-column-${column.type}`}
              title={column.title}
              emptyMessage={column.emptyMessage}
              groups={groupsForType(groups, column.type)}
            />
          ))}
        </div>

        <div className={styles.cardActions}>
          <Button href="/reservation">Réserver</Button>
          <Button href="/contact" variant="secondary">
            Demander un devis
          </Button>
        </div>

        <div className={styles.footerLinks}>
          {config.relatedLinks.map((link) => (
            <Link
              key={link.href}
              href={resolveRelatedLinkHref(link.href, building.slug)}
              className={styles.footerLink}
            >
              {link.label} →
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
