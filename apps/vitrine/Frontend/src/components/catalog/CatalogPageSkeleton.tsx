import { Container } from "@/components/ui/Container";

import styles from "./catalog.module.css";
import skeletonStyles from "./CatalogPageSkeleton.module.css";

export function CatalogPageSkeleton() {
  return (
    <section className={styles.catalogSection} aria-busy="true" aria-label="Chargement">
      <Container>
        <div className={skeletonStyles.selector} />

        <div className={skeletonStyles.hero}>
          <div className={skeletonStyles.heroCopy}>
            <div className={`${skeletonStyles.line} ${skeletonStyles.lineShort}`} />
            <div className={`${skeletonStyles.line} ${skeletonStyles.lineTitle}`} />
            <div className={`${skeletonStyles.line} ${skeletonStyles.lineMedium}`} />
          </div>
          <div className={skeletonStyles.heroImage} />
        </div>

        <div className={`${skeletonStyles.line} ${skeletonStyles.lineLong}`} />

        <div className={skeletonStyles.grid}>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={skeletonStyles.card} />
          ))}
        </div>
      </Container>
    </section>
  );
}
