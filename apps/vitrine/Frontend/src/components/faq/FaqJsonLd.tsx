import { FAQ_ALL_ITEMS, faqItemPlainAnswer } from "@/config/faq-page";
import { SITE_URL } from "@/config/site";

export function FaqJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ALL_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faqItemPlainAnswer(item),
      },
    })),
    url: `${SITE_URL}/faq`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
