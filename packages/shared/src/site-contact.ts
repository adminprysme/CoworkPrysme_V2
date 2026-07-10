import { buildPhoneHref, type SiteContact } from "./buildings.js";

export { SiteContactSchema, buildPhoneHref, type SiteContact } from "./buildings.js";

export const DEFAULT_SITE_CONTACT = {
  email: "contact@prysme.eu",
  phone: "04 78 86 92 55",
  phoneHref: "tel:+33478869255",
} as const;

export function resolveVitrineSiteContact(
  stored: { email: string | null; phone: string | null } | null | undefined,
): SiteContact {
  const email = stored?.email?.trim() || DEFAULT_SITE_CONTACT.email;
  const phone = stored?.phone?.trim() || DEFAULT_SITE_CONTACT.phone;

  return {
    email,
    phone,
    phoneHref: buildPhoneHref(phone) ?? DEFAULT_SITE_CONTACT.phoneHref,
  };
}
