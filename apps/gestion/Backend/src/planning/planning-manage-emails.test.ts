import { describe, expect, it } from "vitest";

import { renderCancellationEmail, renderSpaceChangeEmail } from "./planning-manage-emails.js";

describe("planning-manage-emails amount visibility", () => {
  it("omits all price mentions when space-change difference is not billed", () => {
    const email = renderSpaceChangeEmail({
      reservationReference: "RES-TEST",
      previousSpaceName: "FOCUS",
      nextSpaceName: "FOCUS 2",
      startAt: "26/09/2026 08:00",
      endAt: "25/10/2026 20:00",
      previousTotalTTC: 23999,
      nextTotalTTC: 28799,
      deltaTTC: 4800,
      billedDifference: false,
    });

    expect(email.html).toContain("FOCUS 2");
    expect(email.html).not.toMatch(/€|EUR|montant|factur|écart|supérieur|inférieur/i);
  });

  it("mentions billed adjustment when staff chose to bill the difference", () => {
    const email = renderSpaceChangeEmail({
      reservationReference: "RES-TEST",
      previousSpaceName: "FOCUS",
      nextSpaceName: "FOCUS 2",
      startAt: "26/09/2026 08:00",
      endAt: "25/10/2026 20:00",
      previousTotalTTC: 23999,
      nextTotalTTC: 28799,
      deltaTTC: 4800,
      billedDifference: true,
    });

    expect(email.html).toMatch(/ajusté de/);
    expect(email.html).toMatch(/\+48,00\s*€/);
    expect(email.html).toMatch(/complément vous sera facturé/);
    expect(email.html).not.toMatch(/ne sera pas facturée/);
  });

  it("omits all monetary figures when refundCents is 0 (ne pas rembourser)", () => {
    const email = renderCancellationEmail({
      reservationReference: "RES-TEST",
      spaceName: "FOCUS",
      startAt: "26/09/2026 08:00",
      endAt: "25/10/2026 20:00",
      paidTotalCents: 23999,
      refundCents: 0,
    });

    expect(email.html).toContain("annulée");
    expect(email.html).toContain("FOCUS");
    expect(email.html).toContain("Pour toute question");
    expect(email.html).not.toMatch(/remboursement|Montant réglé|€|EUR/i);
  });

  it("shows paid total and refund amount when a positive refund is confirmed", () => {
    const email = renderCancellationEmail({
      reservationReference: "RES-TEST",
      spaceName: "FOCUS",
      startAt: "26/09/2026 08:00",
      endAt: "25/10/2026 20:00",
      paidTotalCents: 23999,
      refundCents: 12000,
    });

    expect(email.html).toMatch(/Montant réglé/);
    expect(email.html).toMatch(/remboursement/i);
    expect(email.html).toMatch(/120,00\s*€/);
    expect(email.html).toMatch(/239,99\s*€/);
  });
});
