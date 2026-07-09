import type { CatalogBuildingDetail, CatalogSpaceCard } from "@coworkprysme/shared";
import { formatCentsAsEuroString } from "@coworkprysme/shared";

import { SITE, SITE_URL } from "@/config/site";

interface CatalogJsonLdProps {
  building: CatalogBuildingDetail;
  spaces: CatalogSpaceCard[];
  pagePath: string;
}

export function CatalogJsonLd({ building, spaces, pagePath }: CatalogJsonLdProps) {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        name: building.name,
        url: `${SITE_URL}${pagePath}`,
        description: building.description ?? building.tagline ?? SITE.defaultDescription,
        address: {
          "@type": "PostalAddress",
          streetAddress: building.street,
          postalCode: building.postalCode,
          addressLocality: building.city,
          addressCountry: "FR",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: building.coordinates.lat,
          longitude: building.coordinates.lng,
        },
        image: building.primaryPhotoUrl ?? SITE.social.ogImage,
      },
      {
        "@type": "ItemList",
        itemListElement: spaces.map((space, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Product",
            name: space.name,
            offers:
              space.startingPriceHTCents !== null
                ? {
                    "@type": "Offer",
                    priceCurrency: "EUR",
                    price: formatCentsAsEuroString(space.startingPriceHTCents),
                    priceSpecification: {
                      "@type": "UnitPriceSpecification",
                      price: formatCentsAsEuroString(space.startingPriceHTCents),
                      priceCurrency: "EUR",
                      valueAddedTaxIncluded: false,
                    },
                    availability: "https://schema.org/InStock",
                  }
                : undefined,
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
