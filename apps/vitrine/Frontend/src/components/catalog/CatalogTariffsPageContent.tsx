import type {
  CatalogTariffSpaceGroup,
  CatalogTariffsContent,
  SpaceType,
} from "@coworkprysme/shared";
import { SPACE_DURATION_CLASSES, formatCentsAsEuroString } from "@coworkprysme/shared";
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

const DURATION_ORDER = Object.fromEntries(
  SPACE_DURATION_CLASSES.map((durationClass, index) => [durationClass, index]),
) as Record<(typeof SPACE_DURATION_CLASSES)[number], number>;

function groupsForType(
  groups: CatalogTariffSpaceGroup[],
  type: SpaceType,
): CatalogTariffSpaceGroup[] {
  return groups.filter((group) => group.type === type);
}

function sortTariffLines<T extends { durationClass: (typeof SPACE_DURATION_CLASSES)[number] }>(
  lines: T[],
): T[] {
  return [...lines].sort(
    (left, right) => DURATION_ORDER[left.durationClass] - DURATION_ORDER[right.durationClass],
  );
}

function lowestPriceCents(lines: CatalogTariffSpaceGroup["lines"]): number | null {
  if (lines.length === 0) {
    return null;
  }
  return Math.min(...lines.map((line) => line.priceHTCents));
}

interface TariffSpaceCardProps {
  group: CatalogTariffSpaceGroup;
}

function TariffSpaceCard({ group }: TariffSpaceCardProps) {
  const lines = sortTariffLines(group.lines);
  const bestPrice = lowestPriceCents(lines);

  return (
    <article className={styles.tariffsSpaceCard}>
      <h3 className={styles.tariffsSpaceTitle}>{group.spaceName}</h3>

      {lines.length === 0 ? (
        <p className={styles.tariffsSpaceEmpty}>Tarif sur demande</p>
      ) : (
        <ul className={styles.tariffsPriceList}>
          {lines.map((line) => {
            const isBestPrice = bestPrice !== null && line.priceHTCents === bestPrice;
            return (
              <li
                key={line.durationClass}
                className={`${styles.tariffsPriceRow}${isBestPrice ? ` ${styles.tariffsPriceRowHighlight}` : ""}`}
              >
                <span className={styles.tariffsDuration}>{line.label}</span>
                <span className={styles.tariffsPriceBlock}>
                  <span className={styles.tariffsAmount}>
                    {formatCentsAsEuroString(line.priceHTCents)}
                    <span className={styles.tariffsAmountSuffix}> € HT</span>
                  </span>
                  <span className={styles.tariffsVat}>{line.vatRate} % TVA</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
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
          <Link href="/contact" className={styles.tariffsColumnEmptyLink}>
            Nous contacter →
          </Link>
        </div>
      ) : (
        <div className={styles.tariffsColumnCards}>
          {groups.map((group) => (
            <TariffSpaceCard key={group.spaceId} group={group} />
          ))}
        </div>
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
