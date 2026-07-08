import { Container } from "@/components/ui/Container";
import styles from "./PageIntro.module.css";

interface PageIntroProps {
  title: string;
  subtitle?: string;
}

export function PageIntro({ title, subtitle }: PageIntroProps) {
  return (
    <div className={styles.intro}>
      <Container>
        <div className={styles.inner}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
      </Container>
    </div>
  );
}
