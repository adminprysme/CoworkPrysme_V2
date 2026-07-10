import { z } from "zod";

import {
  buildPhoneHref,
  normalizeCountryFromDb,
  normalizeOptionalBuildingContactField,
} from "./buildings.js";
import { DEFAULT_SITE_CONTACT } from "./site-contact.js";

export const PublicBuildingAddressSchema = z.object({
  street: z.string(),
  postalCode: z.string(),
  city: z.string(),
  country: z.string(),
  accessInfo: z.string().nullable(),
  full: z.string(),
});

export const PublicBuildingInfoSchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  phoneHref: z.string().nullable(),
  address: PublicBuildingAddressSchema,
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  mapExternalUrl: z.string(),
});

export type PublicBuildingAddress = z.infer<typeof PublicBuildingAddressSchema>;
export type PublicBuildingInfo = z.infer<typeof PublicBuildingInfoSchema>;

export function formatPublicBuildingAddress(address: {
  street: string;
  postalCode: string;
  city: string;
  accessInfo?: string | null;
}): string {
  const locality = `${address.postalCode} ${address.city}`.trim();
  const parts = [address.street, address.accessInfo?.trim(), locality].filter(Boolean);
  return parts.join(", ");
}

export function buildGoogleMapsUrl(options: {
  lat: number;
  lng: number;
  address?: string;
}): string {
  const query = options.address
    ? encodeURIComponent(options.address)
    : `${options.lat},${options.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Opens Google Maps directions; omitting origin uses the user's current location. */
export function buildGoogleMapsDirectionsUrl(options: {
  lat: number;
  lng: number;
  address?: string;
}): string {
  const destination = options.address
    ? encodeURIComponent(options.address)
    : `${options.lat},${options.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

export const DEFAULT_PUBLIC_BUILDING_INFO: PublicBuildingInfo = {
  name: "Cowork Prysme — Technopark, Bâtiment A1",
  email: DEFAULT_SITE_CONTACT.email,
  phone: DEFAULT_SITE_CONTACT.phone,
  phoneHref: DEFAULT_SITE_CONTACT.phoneHref,
  address: {
    street: "Technopark Lyon — Bâtiment A1, entrée rue Saint-Jean-de-Dieu",
    postalCode: "69007",
    city: "Lyon",
    country: "France",
    accessInfo: null,
    full: "Technopark Lyon — Bâtiment A1, entrée rue Saint-Jean-de-Dieu, 69007 Lyon",
  },
  coordinates: {
    lat: 45.7284,
    lng: 4.8378,
  },
  mapExternalUrl: buildGoogleMapsUrl({
    lat: 45.7284,
    lng: 4.8378,
    address: "Technopark Lyon — Bâtiment A1, entrée rue Saint-Jean-de-Dieu, 69007 Lyon",
  }),
};

interface DbBuildingAddress {
  street: string;
  zip: string;
  city: string;
  country: string;
  accessInfo?: string;
}

interface DbBuildingLike {
  name: string;
  email?: string;
  phone?: string;
  address: DbBuildingAddress;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export function mapDbBuildingToPublicInfo(building: DbBuildingLike): PublicBuildingInfo {
  const email = normalizeOptionalBuildingContactField(building.email) ?? DEFAULT_SITE_CONTACT.email;
  const phone = normalizeOptionalBuildingContactField(building.phone) ?? DEFAULT_SITE_CONTACT.phone;
  const phoneHref = buildPhoneHref(phone) ?? DEFAULT_SITE_CONTACT.phoneHref;
  const accessInfo = building.address.accessInfo?.trim() || null;
  const address = {
    street: building.address.street.trim(),
    postalCode: building.address.zip.trim(),
    city: building.address.city.trim(),
    country: normalizeCountryFromDb(building.address.country),
    accessInfo,
    full: formatPublicBuildingAddress({
      street: building.address.street.trim(),
      postalCode: building.address.zip.trim(),
      city: building.address.city.trim(),
      accessInfo,
    }),
  };
  const { lat, lng } = building.coordinates;

  return PublicBuildingInfoSchema.parse({
    name: building.name.trim(),
    email,
    phone,
    phoneHref,
    address,
    coordinates: { lat, lng },
    mapExternalUrl: buildGoogleMapsUrl({
      lat,
      lng,
      address: address.full,
    }),
  });
}
