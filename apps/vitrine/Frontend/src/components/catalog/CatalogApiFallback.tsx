import Link from "next/link";

import { Container } from "@/components/ui/Container";

import styles from "./catalog.module.css";

export function CatalogApiFallback() {
  return (
    <section className={styles.catalogSection}>
      <Container>
        <div className={styles.apiFallback}>
          <p>Les espaces sont momentanément indisponibles. Réessayez dans quelques instants.</p>
          <p>
            <Link href="/contact">Contactez-nous</Link> pour obtenir les disponibilités et tarifs.
          </p>
        </div>
      </Container>
    </section>
  );
}
