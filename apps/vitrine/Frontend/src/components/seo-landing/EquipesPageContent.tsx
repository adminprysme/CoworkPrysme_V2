import { PageIntro } from "@/components/pages/PageIntro";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import type { SeoLandingPageConfig } from "@/config/seo-landing-pages";

import { LocalBusinessJsonLd } from "./LocalBusinessJsonLd";
import { SeoLandingFooter } from "./SeoLandingFooter";
import layout from "./seo-landing-layouts.module.css";

interface Props {
  page: SeoLandingPageConfig;
}

export function EquipesPageContent({ page }: Props) {
  const [formats, admin] = page.sections;

  const formatParts = formats.body.split(" — ");
  const formatsList = formatParts[0] ?? formats.body;
  const formatsSuffix = formatParts[1];
  const formatItems = formatsList.split(", ").map((item) => item.trim());
  const adminParts = admin.body.split(", ").map((part) => part.trim());

  return (
    <>
      <LocalBusinessJsonLd />
      <PageIntro title={page.h1} subtitle={page.intro} />

      <Section>
        <Container>
          <ScrollReveal>
            <SectionHeading title={formats.title} />
            <div className={layout.formatGrid}>
              {formatItems.map((item) => (
                <div key={item} className={layout.formatItem}>
                  {item}
                </div>
              ))}
            </div>
            {formatsSuffix ? (
              <p className={`${layout.bodyText} ${layout.suffixNote}`}>{formatsSuffix}</p>
            ) : null}
          </ScrollReveal>
        </Container>
      </Section>

      <Section muted>
        <Container>
          <ScrollReveal>
            <SectionHeading title={admin.title} />
            <ul className={layout.checkList}>
              {adminParts.map((part) => (
                <li key={part} className={layout.checkItem}>
                  {part}
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </Container>
      </Section>

      <SeoLandingFooter cta={page.cta} relatedLinks={page.relatedLinks} />
    </>
  );
}
