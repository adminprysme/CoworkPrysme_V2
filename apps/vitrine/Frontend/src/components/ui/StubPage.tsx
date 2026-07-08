import Link from "next/link";

import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import styles from "./StubPage.module.css";

interface StubPageProps {
  title: string;
  description?: string;
}

export function StubPage({ title, description }: StubPageProps) {
  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          <span className={styles.badge}>Page à venir</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.message}>
            {description ??
              "Cette page sera bientôt disponible. En attendant, découvrez Cowork Prysme depuis l'accueil."}
          </p>
          <Button href="/" variant="secondary">
            Retour à l&apos;accueil
          </Button>
          <Link href="/contact" className="sr-only">
            Contact
          </Link>
        </div>
      </Container>
    </div>
  );
}
