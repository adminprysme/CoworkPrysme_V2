/**
 * #10 — Devis / Facturation E2E final (domain integration).
 *
 * Chains the real domain functions used by gestion + vitrine APIs:
 * create draft → send (token) → accept → payment link → Stripe apply →
 * confirm ALL Option-A reservations ; staff bootstrap → activation → login.
 *
 * No Nest mocks — MongoMemoryReplSet + transactional paths.
 */
import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { recomputeQuotePricing } from "@coworkprysme/shared";

import { connectMongo, getCoworkDb } from "../../connection.js";
import {
  acceptQuote,
  applyStripeCardPayment,
  attachQuoteAcceptToken,
  consumeQuotePaymentLink,
  getInvoiceModel,
  getPaymentModel,
  getQuoteByAcceptToken,
  getQuoteModel,
  getQuotePaymentLinkModel,
  redeemQuotePaymentLink,
  registerInvoiceModel,
  registerPaymentModel,
  registerQuoteModel,
  registerQuotePaymentLinkModel,
  type AcceptQuoteError,
  type QuoteAcceptLookupError,
  type QuotePaymentLinkLookupError,
} from "../../domains/billing/index.js";
import {
  consumeClientAccountActivation,
  getCardexModel,
  getClientAccountActivationModel,
  getClientAccountModel,
  registerCardexModel,
  registerClientAccountActivationModel,
  registerClientAccountModel,
} from "../../domains/client/index.js";
import {
  confirmReservationAfterCardPayment,
  verifyClientAccountCredentials,
} from "../../domains/booking/index.js";
import { AccountPendingActivationError } from "../../lib/errors.js";
import {
  ensureReservationIndexes,
  getReservationModel,
  registerReservationModel,
  registerSlotLockModel,
} from "../../domains/reservation/index.js";
import { registerSpaceModel, getSpaceModel } from "../../domains/structure/space.schema.js";
import { registerReferenceSequenceModel } from "../../lib/reference-sequences.js";
import {
  clearCoworkCollections,
  configureIntegrationEnv,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./setup.js";

const ACCEPT_SECRET = "quote-accept-e2e-secret-at-least-32chars!!";
const PAYMENT_SECRET = "quote-payment-e2e-secret-at-least-32chars!";
const ACTIVATION_SECRET = "activation-e2e-secret-at-least-32chars!!!";
const NOW = new Date("2026-07-15T12:00:00.000Z");
const VALID_UNTIL = new Date("2026-08-01T22:00:00.000Z");
const STAFF_ID = new Types.ObjectId();

async function seedSpace(name: string) {
  const Space = await getSpaceModel();
  const buildingId = new Types.ObjectId();
  const [space] = await Space.create([
    {
      buildingId,
      type: "meeting_room",
      name,
      capacity: 8,
      equipments: [],
      photos: [],
      openingHours: [],
      status: "active",
      seo: {
        slug: `e2e-${name.toLowerCase()}-${new Types.ObjectId().toHexString().slice(-6)}`,
        metaTitle: name,
        metaDescription: "e2e",
      },
      tariffs: [],
      featuredOnVitrine: false,
    },
  ]);
  return { spaceId: space!._id as Types.ObjectId, buildingId };
}

function buildMultiSpaceDraftLines(
  a: { spaceId: Types.ObjectId; buildingId: Types.ObjectId },
  b: { spaceId: Types.ObjectId; buildingId: Types.ObjectId },
) {
  // Override on space A (forced) + auto space B + service — deposit 30% with TVA acompte.
  const priced = recomputeQuotePricing({
    depositPercent: 30,
    lines: [
      {
        calculatedUnitPriceHT: 25_000,
        forcedUnitPriceHT: 20_000,
        priceSource: "forced",
        qty: 1,
        vatRate: 20,
      },
      {
        calculatedUnitPriceHT: 25_000,
        qty: 1,
        vatRate: 20,
      },
      {
        calculatedUnitPriceHT: 500,
        qty: 1,
        vatRate: 20,
      },
    ],
  });

  const meta = [
    {
      lineId: "line-focus",
      kind: "space" as const,
      label: "FOCUS — journée (override)",
      spaceId: a.spaceId,
      buildingId: a.buildingId,
      startAt: new Date("2026-08-10T08:00:00.000Z"),
      endAt: new Date("2026-08-10T18:00:00.000Z"),
      partySize: 2,
      durationClass: "daily" as const,
      units: 1,
      priceOverrideReason: "Geste commercial E2E",
      priceOverrideByStaffProfileId: STAFF_ID,
      priceOverrideAt: NOW,
    },
    {
      lineId: "line-open",
      kind: "space" as const,
      label: "OPEN — journée",
      spaceId: b.spaceId,
      buildingId: b.buildingId,
      startAt: new Date("2026-08-11T08:00:00.000Z"),
      endAt: new Date("2026-08-11T18:00:00.000Z"),
      partySize: 4,
      durationClass: "daily" as const,
      units: 1,
    },
    {
      lineId: "svc-cafe",
      kind: "service" as const,
      label: "Café",
    },
  ];

  const lines = priced.lines.map((p, i) => ({
    ...meta[i]!,
    calculatedUnitPriceHT: p.calculatedUnitPriceHT,
    calculatedTotalHT: p.calculatedTotalHT,
    calculatedTotalVAT: p.calculatedTotalVAT,
    calculatedTotalTTC: p.calculatedTotalTTC,
    unitPriceHT: p.unitPriceHT,
    qty: p.qty,
    vatRate: p.vatRate,
    discount: p.discount,
    totalHT: p.totalHT,
    totalVAT: p.totalVAT,
    totalTTC: p.totalTTC,
    priceSource: p.priceSource,
    ...(p.forcedUnitPriceHT !== undefined ? { forcedUnitPriceHT: p.forcedUnitPriceHT } : {}),
  }));

  return {
    lines,
    vatBreakdown: priced.vatBreakdown,
    totals: priced.totals,
    depositPercent: priced.deposit.depositPercent,
    depositAmountHT: priced.deposit.depositAmountHT,
    depositAmountTTC: priced.deposit.depositAmountTTC,
    depositVatBreakdown: priced.deposit.depositVatBreakdown,
  };
}

async function createDraftQuote(input: {
  a: { spaceId: Types.ObjectId; buildingId: Types.ObjectId };
  b: { spaceId: Types.ObjectId; buildingId: Types.ObjectId };
  email?: string;
}) {
  const pricing = buildMultiSpaceDraftLines(input.a, input.b);
  const Quote = await getQuoteModel();
  const [quote] = await Quote.create([
    {
      reference: `DEV-E2E-${new Types.ObjectId().toHexString().slice(-6)}`,
      currency: "EUR",
      status: "draft",
      lines: pricing.lines,
      vatBreakdown: pricing.vatBreakdown,
      totals: pricing.totals,
      depositPercent: pricing.depositPercent,
      depositAmountHT: pricing.depositAmountHT,
      depositAmountTTC: pricing.depositAmountTTC,
      depositVatBreakdown: pricing.depositVatBreakdown,
      paymentSituation: "deposit",
      paymentMethodPreferred: "card",
      validUntil: VALID_UNTIL,
      prospect: {
        email: input.email ?? "e2e.client@example.com",
        firstName: "Eve",
        lastName: "Dupont",
        phone: "0611223344",
        clientKind: "individual",
        billingAddress: {
          street: "1 rue E2E",
          zip: "69001",
          city: "Lyon",
          country: "FR",
        },
      },
      reservationIds: [],
      createdByStaffProfileId: STAFF_ID,
      internalNote: "NOTE_INTERNE_E2E_NEVER_CLIENT",
    },
  ]);
  return { quote: quote!, pricing };
}

/** Mirrors QuotesService.send: attach accept token + draft → sent (sans cardex). */
async function sendDraftQuote(quoteId: Types.ObjectId) {
  const token = await attachQuoteAcceptToken({
    quoteId,
    tokenSecret: ACCEPT_SECRET,
    now: NOW,
  });
  const Quote = await getQuoteModel();
  const updated = await Quote.findOneAndUpdate(
    { _id: quoteId, status: "draft" },
    {
      $set: {
        status: "sent",
        sentAt: NOW,
        acceptTokenHash: token.tokenHash,
        acceptTokenExpiresAt: token.expiresAt,
      },
    },
    { returnDocument: "after" },
  ).exec();
  if (!updated) {
    throw new Error("sendDraftQuote: quote not draft");
  }
  return { quote: updated, rawToken: token.rawToken, expiresAt: token.expiresAt };
}

describe("E2E #10 — Devis / Facturation (full domain chain)", () => {
  beforeAll(async () => {
    const uri = await startIntegrationMongo();
    await configureIntegrationEnv(uri);
    await connectMongo();
    const connection = await getCoworkDb();
    registerSlotLockModel(connection);
    registerReservationModel(connection);
    registerClientAccountModel(connection);
    registerClientAccountActivationModel(connection);
    registerCardexModel(connection);
    registerInvoiceModel(connection);
    registerPaymentModel(connection);
    registerQuoteModel(connection);
    registerQuotePaymentLinkModel(connection);
    registerSpaceModel(connection);
    registerReferenceSequenceModel(connection);
    await ensureReservationIndexes();
  }, 120_000);

  afterEach(async () => {
    await clearCoworkCollections();
  });

  afterAll(async () => {
    await stopIntegrationMongo();
  });

  it("1) multi-espace: draft → send sans cardex → accept client (nouveau compte) → acompte → résas confirmed", async () => {
    const a = await seedSpace("FOCUS");
    const b = await seedSpace("OPEN");
    const { quote, pricing } = await createDraftQuote({ a, b });

    // Pricing proofs baked into the draft (override + deposit TVA).
    expect(pricing.lines[0]!.priceSource).toBe("forced");
    expect(pricing.lines[0]!.forcedUnitPriceHT).toBe(20_000);
    expect(pricing.lines[0]!.calculatedUnitPriceHT).toBe(25_000);
    expect(pricing.depositPercent).toBe(30);
    expect(pricing.depositAmountTTC).toBe(Math.round((pricing.totals.ttc * 30) / 100));
    expect(pricing.depositVatBreakdown.length).toBeGreaterThan(0);
    expect(
      pricing.depositAmountHT + pricing.depositVatBreakdown.reduce((s, r) => s + r.vat, 0),
    ).toBe(pricing.depositAmountTTC);
    expect(quote.cardexId).toBeUndefined();

    const sent = await sendDraftQuote(quote._id);
    expect(sent.quote.status).toBe("sent");
    expect(sent.quote.internalNote).toBe("NOTE_INTERNE_E2E_NEVER_CLIENT");
    expect(sent.rawToken).toMatch(/^[a-f0-9]{64}$/);

    // Client opens accept link (token lookup).
    const lookedUp = await getQuoteByAcceptToken(sent.rawToken, ACCEPT_SECRET, NOW);
    expect(String(lookedUp._id)).toBe(String(quote._id));
    expect(lookedUp.status).toBe("sent");

    const accepted = await acceptQuote({
      quoteId: quote._id,
      actor: {
        kind: "client_register",
        password: "E2eClientPass1!",
        privacyPolicyVersion: "2026-07-01",
        marketingCommunicationsAccepted: false,
      },
      now: NOW,
      paymentLinkTokenSecret: PAYMENT_SECRET,
    });

    expect(accepted.bootstrapped).toBe(false);
    expect(accepted.reservationIds).toHaveLength(2);
    expect(accepted.paymentLink?.amountDueCents).toBe(pricing.depositAmountTTC);
    expect(accepted.paymentLink?.rawToken).toMatch(/^[a-f0-9]{64}$/);

    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findById(accepted.clientAccountId).lean().exec();
    expect(account?.status).toBe("active");
    expect(account?.email).toBe("e2e.client@example.com");

    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findById(accepted.invoiceId).lean().exec();
    expect(invoice?.type).toBe("proforma");
    expect(invoice?.reservationIds?.map(String).sort()).toEqual(
      accepted.reservationIds.map(String).sort(),
    );
    expect(invoice?.lines).toHaveLength(3);
    // TVA acompte lives on Quote (PDF invoice reads quote.deposit* — not a Invoice field).
    const QuoteAfter = await getQuoteModel();
    const acceptedQuote = await QuoteAfter.findById(quote._id).lean().exec();
    expect(acceptedQuote?.depositVatBreakdown?.length).toBeGreaterThan(0);
    expect(acceptedQuote?.depositAmountTTC).toBe(pricing.depositAmountTTC);

    // Cross-invoice redeem → uniform not-found (point 7).
    const otherInvoiceId = new Types.ObjectId();
    await expect(
      redeemQuotePaymentLink({
        rawToken: accepted.paymentLink!.rawToken,
        invoiceId: otherInvoiceId,
        tokenSecret: PAYMENT_SECRET,
      }),
    ).rejects.toMatchObject({
      name: "QuotePaymentLinkLookupError",
      code: "PAYMENT_LINK_NOT_FOUND",
    } satisfies Partial<QuotePaymentLinkLookupError>);

    const redeemed = await redeemQuotePaymentLink({
      rawToken: accepted.paymentLink!.rawToken,
      invoiceId: accepted.invoiceId,
      tokenSecret: PAYMENT_SECRET,
    });
    expect(redeemed.amountDueCentsSnapshot).toBe(pricing.depositAmountTTC);
    expect(String(redeemed.quoteId)).toBe(String(quote._id));

    const piId = `pi_e2e_${new Types.ObjectId().toHexString()}`;
    const paid = await applyStripeCardPayment({
      stripePaymentIntentId: piId,
      invoiceId: accepted.invoiceId,
      amountReceived: pricing.depositAmountTTC,
      expectedAmountCents: pricing.depositAmountTTC,
      receivedAt: NOW,
    });
    expect(paid.applied).toBe(true);
    expect(paid.invoice.totals.paidTotal).toBe(pricing.depositAmountTTC);

    // Webhook Option A — confirm ALL reservations of the quote group.
    for (const reservationId of accepted.reservationIds) {
      const confirmed = await confirmReservationAfterCardPayment({ reservationId });
      expect(confirmed.transitioned).toBe(true);
      expect(confirmed.reservation.status).toBe("confirmed");
    }

    await consumeQuotePaymentLink({
      paymentLinkId: accepted.paymentLink!.paymentLinkId,
      stripePaymentIntentId: piId,
    });

    const Reservation = await getReservationModel();
    const reservations = await Reservation.find({ quoteId: quote._id }).lean().exec();
    expect(reservations).toHaveLength(2);
    for (const res of reservations) {
      expect(res.status).toBe("confirmed");
      expect(String(res.quoteId)).toBe(String(quote._id));
    }

    const QuotePaymentLink = await getQuotePaymentLinkModel();
    const link = await QuotePaymentLink.findById(accepted.paymentLink!.paymentLinkId).lean().exec();
    expect(link?.status).toBe("consumed");

    const Payment = await getPaymentModel();
    const payments = await Payment.find({ invoiceId: accepted.invoiceId }).lean().exec();
    expect(payments).toHaveLength(1);
    expect(payments[0]!.amount).toBe(pricing.depositAmountTTC);
    expect(payments[0]!.method).toBe("card");

    // Login works after client_register path.
    await expect(
      verifyClientAccountCredentials("e2e.client@example.com", "E2eClientPass1!"),
    ).resolves.toBe(true);
  }, 30_000);

  it("2) staff-accept oral: bootstrap pending_activation → activation MDP → connexion", async () => {
    const a = await seedSpace("FOCUS");
    const b = await seedSpace("OPEN");
    const { quote } = await createDraftQuote({
      a,
      b,
      email: "e2e.staffpath@example.com",
    });
    await sendDraftQuote(quote._id);

    const accepted = await acceptQuote({
      quoteId: quote._id,
      actor: {
        kind: "staff",
        staffProfileId: STAFF_ID,
        activationTokenSecret: ACTIVATION_SECRET,
      },
      now: NOW,
      paymentLinkTokenSecret: PAYMENT_SECRET,
    });

    expect(accepted.bootstrapped).toBe(true);
    expect(accepted.activation?.rawToken).toBeTruthy();
    expect(accepted.reservationIds).toHaveLength(2);

    const ClientAccount = await getClientAccountModel();
    const pending = await ClientAccount.findById(accepted.clientAccountId).lean().exec();
    expect(pending?.status).toBe("pending_activation");
    expect(pending?.status).not.toBe("locked");

    const Cardex = await getCardexModel();
    const cardex = await Cardex.findById(accepted.cardexId).lean().exec();
    expect(cardex).toBeTruthy();
    expect(String(cardex?.clientAccountId)).toBe(String(accepted.clientAccountId));

    // Login blocked with dedicated pending_activation error (≠ ACCOUNT_LOCKED).
    await expect(
      verifyClientAccountCredentials("e2e.staffpath@example.com", "anything"),
    ).rejects.toBeInstanceOf(AccountPendingActivationError);

    const activated = await consumeClientAccountActivation({
      rawToken: accepted.activation!.rawToken,
      tokenSecret: ACTIVATION_SECRET,
      password: "ActivatedPass2!",
      now: NOW,
      email: "e2e.staffpath@example.com",
    });
    expect(String(activated.clientAccountId)).toBe(String(accepted.clientAccountId));

    const after = await ClientAccount.findById(accepted.clientAccountId).lean().exec();
    expect(after?.status).toBe("active");

    const Activation = await getClientAccountActivationModel();
    const activationDoc = await Activation.findById(accepted.activation!.activationId)
      .lean()
      .exec();
    expect(activationDoc?.status).toBe("consumed");

    await expect(
      verifyClientAccountCredentials("e2e.staffpath@example.com", "ActivatedPass2!"),
    ).resolves.toBe(true);

    // Wrong password still fails after activation.
    await expect(
      verifyClientAccountCredentials("e2e.staffpath@example.com", "wrong"),
    ).resolves.toBe(false);
  }, 30_000);

  it("3) gardes E2E: devis expiré, transitions interdites, cross-quote/invoice 404", async () => {
    const a = await seedSpace("FOCUS");
    const b = await seedSpace("OPEN");

    // --- Expired validUntil while still "sent"
    const { quote: expiredQuote } = await createDraftQuote({
      a,
      b,
      email: "e2e.expired@example.com",
    });
    await sendDraftQuote(expiredQuote._id);
    const Quote = await getQuoteModel();
    await Quote.updateOne(
      { _id: expiredQuote._id },
      { $set: { validUntil: new Date("2026-07-01T00:00:00.000Z") } },
    ).exec();

    await expect(
      acceptQuote({
        quoteId: expiredQuote._id,
        actor: {
          kind: "client_register",
          password: "ExpiredPass1!",
          privacyPolicyVersion: "2026-07-01",
        },
        now: NOW,
        paymentLinkTokenSecret: PAYMENT_SECRET,
      }),
    ).rejects.toMatchObject({
      name: "AcceptQuoteError",
      code: "QUOTE_EXPIRED",
    } satisfies Partial<AcceptQuoteError>);

    const stillSent = await Quote.findById(expiredQuote._id).lean().exec();
    expect(stillSent?.status).toBe("sent");

    // --- Forbidden: accept draft (not sent)
    const { quote: draftOnly } = await createDraftQuote({
      a,
      b,
      email: "e2e.draft@example.com",
    });
    await expect(
      acceptQuote({
        quoteId: draftOnly._id,
        actor: {
          kind: "staff",
          staffProfileId: STAFF_ID,
          activationTokenSecret: ACTIVATION_SECRET,
        },
        now: NOW,
        paymentLinkTokenSecret: PAYMENT_SECRET,
      }),
    ).rejects.toMatchObject({ code: "QUOTE_INVALID_STATUS" });

    // --- Hard delete draft (domain invariant mirrored by QuotesService.deleteDraft)
    await draftOnly.deleteOne();
    const gone = await Quote.findById(draftOnly._id).lean().exec();
    expect(gone).toBeNull();

    // --- Accept token unknown / wrong secret → uniform not-found
    await expect(getQuoteByAcceptToken("a".repeat(64), ACCEPT_SECRET, NOW)).rejects.toMatchObject({
      name: "QuoteAcceptLookupError",
      code: "QUOTE_ACCEPT_NOT_FOUND",
    } satisfies Partial<QuoteAcceptLookupError>);

    // --- Happy path enough to mint a payment link, then cross-invoice 404
    const { quote: payQuote } = await createDraftQuote({
      a,
      b,
      email: "e2e.crosspay@example.com",
    });
    await sendDraftQuote(payQuote._id);
    const accepted = await acceptQuote({
      quoteId: payQuote._id,
      actor: {
        kind: "client_register",
        password: "CrossPayPass1!",
        privacyPolicyVersion: "2026-07-01",
      },
      now: NOW,
      paymentLinkTokenSecret: PAYMENT_SECRET,
    });
    expect(accepted.paymentLink).toBeTruthy();

    await expect(
      redeemQuotePaymentLink({
        rawToken: accepted.paymentLink!.rawToken,
        invoiceId: new Types.ObjectId(),
        tokenSecret: PAYMENT_SECRET,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_LINK_NOT_FOUND" });

    // Wrong token secret / garbage → same not-found (no oracle).
    await expect(
      redeemQuotePaymentLink({
        rawToken: "b".repeat(64),
        invoiceId: accepted.invoiceId,
        tokenSecret: PAYMENT_SECRET,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_LINK_NOT_FOUND" });

    // Double-accept forbidden.
    await expect(
      acceptQuote({
        quoteId: payQuote._id,
        actor: {
          kind: "staff",
          staffProfileId: STAFF_ID,
          activationTokenSecret: ACTIVATION_SECRET,
        },
        now: NOW,
        paymentLinkTokenSecret: PAYMENT_SECRET,
      }),
    ).rejects.toMatchObject({ code: "QUOTE_INVALID_STATUS" });
  }, 30_000);
});
