import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { CLIENT_PORTAL_URL } from "@/config/site";
import { HOME_CONTENT } from "@/config/home";
import { HeroCarousel } from "./HeroCarousel";
import styles from "./HeroSection.module.css";

interface HeroSectionProps {
  heroImages: string[];
}

export function HeroSection({ heroImages }: HeroSectionProps) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <HeroCarousel images={heroImages} />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.content}>
        <Container>
          <div className={styles.inner}>
            <p className={styles.eyebrow}>Coworking premium · Lyon 7</p>
            <h1 id="hero-title" className={styles.title}>
              {HOME_CONTENT.hero.title}
            </h1>
            <p className={styles.subtitle}>{HOME_CONTENT.hero.subtitle}</p>
            <div className={styles.ctaRow}>
              <Button href={CLIENT_PORTAL_URL} variant="primary" size="lg">
                S&apos;identifier
              </Button>
              <Button href="/services" variant="outlineLight" size="lg">
                Découvrez nos services
              </Button>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
