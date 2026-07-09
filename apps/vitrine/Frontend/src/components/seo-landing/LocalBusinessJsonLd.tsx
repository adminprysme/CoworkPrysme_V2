import { SITE, SITE_URL } from "@/config/site";

const MOCK_ADDRESS = {
  streetAddress: "39 rue Saint Jean de Dieu",
  postalCode: "69007",
  addressLocality: "Lyon",
  addressCountry: "FR",
} as const;

export function LocalBusinessJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE.name,
    url: SITE_URL,
    description: SITE.defaultDescription,
    telephone: SITE.contact.phone,
    email: SITE.contact.email,
    address: {
      "@type": "PostalAddress",
      ...MOCK_ADDRESS,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 45.7231135,
      longitude: 4.8456825,
    },
    areaServed: {
      "@type": "City",
      name: "Lyon",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
