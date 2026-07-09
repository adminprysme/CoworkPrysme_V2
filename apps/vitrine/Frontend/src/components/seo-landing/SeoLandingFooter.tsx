import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import type { SeoLandingPageConfig } from "@/config/seo-landing-pages";

import styles from "./SeoLandingFooter.module.css";

interface SeoLandingFooterProps {
  cta: SeoLandingPageConfig["cta"];
  relatedLinks: SeoLandingPageConfig["relatedLinks"];
}

export function SeoLandingFooter({ cta, relatedLinks }: SeoLandingFooterProps) {
  return (
    <div className={styles.footer}>
      <Container>
        <ScrollReveal>
          <div className={styles.related}>
            <p className={styles.relatedLabel}>À découvrir aussi</p>
            <ul className={styles.relatedList}>
              {relatedLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.relatedLink}>
                    {link.label}
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <div className={styles.ctaBlock}>
            <Button href={cta.href} size="lg">
              {cta.label}
              <span aria-hidden="true"> →</span>
            </Button>
          </div>
        </ScrollReveal>
      </Container>
    </div>
  );
}
