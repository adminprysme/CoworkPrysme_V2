import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_CONTACT, resolveVitrineSiteContact } from "./site-contact.js";

describe("resolveVitrineSiteContact", () => {
  it("uses vitrine values when provided", () => {
    expect(
      resolveVitrineSiteContact({
        email: "accueil@coworkprysme.eu",
        phone: "04 11 22 33 44",
      }),
    ).toEqual({
      email: "accueil@coworkprysme.eu",
      phone: "04 11 22 33 44",
      phoneHref: "tel:+33411223344",
    });
  });

  it("falls back to defaults when vitrine contact is empty", () => {
    expect(resolveVitrineSiteContact({ email: null, phone: null })).toEqual(DEFAULT_SITE_CONTACT);
  });
});
