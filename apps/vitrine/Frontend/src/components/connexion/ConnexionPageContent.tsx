import Link from "next/link";

import { Container } from "@/components/ui/Container";

import styles from "./ConnexionPageContent.module.css";

export function ConnexionPageContent() {
  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.shell}>
          <section className={styles.card} aria-labelledby="connexion-title">
            <p className={styles.eyebrow}>Espace client</p>
            <h1 className={styles.title} id="connexion-title">
              Connexion
            </h1>
            <p className={styles.body}>
              L&apos;espace client dédié n&apos;est pas encore disponible. Si vous venez de créer
              votre compte collaborateur, vos identifiants sont enregistrés et pourront être
              utilisés dès son ouverture.
            </p>
            <p className={styles.body}>
              En attendant, vous pouvez réserver un espace avec le même email et mot de passe via le
              tunnel de réservation.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} href="/reservation">
                Réserver
              </Link>
              <Link className={styles.secondaryButton} href="/">
                Retour à l&apos;accueil
              </Link>
            </div>
          </section>
        </div>
      </Container>
    </div>
  );
}
