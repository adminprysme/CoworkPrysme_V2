export { SiteContactSchema, buildPhoneHref, type SiteContact } from "./buildings.js";

export const DEFAULT_SITE_CONTACT = {
  email: "contact@prysme.eu",
  phone: "04 78 86 92 55",
  phoneHref: "tel:+33478869255",
} as const;
