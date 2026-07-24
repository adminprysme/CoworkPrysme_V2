import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb } from "../../connection.js";
import {
  acceptQuote,
  AcceptQuoteError,
  getInvoiceModel,
  getQuoteModel,
  registerInvoiceModel,
  registerQuoteModel,
} from "../../domains/billing/index.js";
import {
  getCardexModel,
  getClientAccountActivationModel,
  getClientAccountModel,
  registerCardexModel,
  registerClientAccountActivationModel,
  registerClientAccountModel,
  createClientAccount,
} from "../../domains/client/index.js";
import {
  acquireLock,
  createReservation,
  ensureReservationIndexes,
  findActiveLocksBySessionId,
  getReservationModel,
  registerReservationModel,
  registerSlotLockModel,
  buildStaffQuoteLockSessionId,
} from "../../domains/reservation/index.js";
import { registerSpaceModel, getSpaceModel } from "../../domains/structure/space.schema.js";
import { registerReferenceSequenceModel } from "../../lib/reference-sequences.js";
import {
  clearCoworkCollections,
  configureIntegrationEnv,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./setup.js";

const ACTIVATION_SECRET = "activation-secret-at-least-32-chars!!";
const NOW = new Date("2026-07-15T12:00:00.000Z");
const VALID_UNTIL = new Date("2026-08-01T22:00:00.000Z");

function spaceLine(
  spaceId: Types.ObjectId,
  buildingId: Types.ObjectId,
  overrides: Record<string, unknown> = {},
) {
  return {
    lineId: `line-${spaceId.toHexString().slice(-4)}`,
    kind: "space" as const,
    label: "FOCUS — journée",
    spaceId,
    buildingId,
    startAt: new Date("2026-08-10T08:00:00.000Z"),
    endAt: new Date("2026-08-10T18:00:00.000Z"),
    partySize: 2,
    durationClass: "daily" as const,
    units: 1,
    calculatedUnitPriceHT: 25000,
    calculatedTotalHT: 25000,
    calculatedTotalVAT: 5000,
    calculatedTotalTTC: 30000,
    unitPriceHT: 25000,
    qty: 1,
    vatRate: 20,
    discount: 0,
    totalHT: 25000,
    totalVAT: 5000,
    totalTTC: 30000,
    priceSource: "auto" as const,
    ...overrides,
  };
}

function serviceLine() {
  return {
    lineId: "svc-1",
    kind: "service" as const,
    label: "Café",
    calculatedUnitPriceHT: 500,
    calculatedTotalHT: 500,
    calculatedTotalVAT: 100,
    calculatedTotalTTC: 600,
    unitPriceHT: 500,
    qty: 1,
    vatRate: 20,
    discount: 0,
    totalHT: 500,
    totalVAT: 100,
    totalTTC: 600,
    priceSource: "auto" as const,
  };
}

async function seedSpace(name = "FOCUS") {
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
        slug: `space-${name.toLowerCase()}-${new Types.ObjectId().toHexString().slice(-6)}`,
        metaTitle: name,
        metaDescription: "test",
      },
      tariffs: [],
      featuredOnVitrine: false,
    },
  ]);
  return { spaceId: space!._id as Types.ObjectId, buildingId, space };
}

async function seedSentQuote(input: {
  spaceId: Types.ObjectId;
  buildingId: Types.ObjectId;
  secondSpace?: { spaceId: Types.ObjectId; buildingId: Types.ObjectId };
  overrides?: Record<string, unknown>;
}) {
  const Quote = await getQuoteModel();
  const lines = [
    spaceLine(input.spaceId, input.buildingId),
    ...(input.secondSpace
      ? [
          spaceLine(input.secondSpace.spaceId, input.secondSpace.buildingId, {
            lineId: "line-2",
            label: "OPEN — journée",
            startAt: new Date("2026-08-11T08:00:00.000Z"),
            endAt: new Date("2026-08-11T18:00:00.000Z"),
          }),
        ]
      : []),
    serviceLine(),
  ];
  const ht = lines.reduce((s, l) => s + l.totalHT, 0);
  const vat = lines.reduce((s, l) => s + l.totalVAT, 0);
  const ttc = lines.reduce((s, l) => s + l.totalTTC, 0);

  const [quote] = await Quote.create([
    {
      reference: `DEV-2026-${new Types.ObjectId().toHexString().slice(-5)}`,
      currency: "EUR",
      lines,
      vatBreakdown: [{ rate: 20, baseHT: ht, vat }],
      totals: { ht, vat, ttc, discountTotal: 0 },
      depositPercent: 30,
      depositAmountHT: Math.round(ht * 0.3),
      depositAmountTTC: Math.round(ttc * 0.3),
      paymentSituation: "deposit",
      paymentMethodPreferred: "card",
      status: "sent",
      validUntil: VALID_UNTIL,
      sentAt: NOW,
      prospect: {
        email: "prospect@example.com",
        firstName: "Alice",
        lastName: "Martin",
        phone: "0612345678",
        clientKind: "individual",
        billingAddress: {
          street: "10 rue Test",
          zip: "69001",
          city: "Lyon",
          country: "FR",
        },
      },
      acceptTokenHash: "deadbeef".repeat(8),
      acceptTokenExpiresAt: VALID_UNTIL,
      ...input.overrides,
    },
  ]);
  return quote!;
}

describe("integration: acceptQuote (unified AcceptQuoteService)", () => {
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
    registerQuoteModel(connection);
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

  it("exports a single acceptQuote domain function used by both paths (structure proof)", async () => {
    // Same named export — staff and client API layers must import this symbol.
    expect(typeof acceptQuote).toBe("function");
    expect(acceptQuote.name).toBe("acceptQuote");
  });

  it("staff path: bootstraps pending_activation + N reservations + 1 invoice in one txn (§5.1.3)", async () => {
    const a = await seedSpace("FOCUS");
    const b = await seedSpace("OPEN");
    const quote = await seedSentQuote({
      spaceId: a.spaceId,
      buildingId: a.buildingId,
      secondSpace: { spaceId: b.spaceId, buildingId: b.buildingId },
    });
    const staffProfileId = new Types.ObjectId();
    const lockSessionId = buildStaffQuoteLockSessionId(String(staffProfileId), String(quote._id));
    await acquireLock({
      spaceId: a.spaceId,
      startAt: new Date("2026-08-10T08:00:00.000Z"),
      endAt: new Date("2026-08-10T18:00:00.000Z"),
      sessionId: lockSessionId,
    });

    const result = await acceptQuote({
      quoteId: quote._id,
      actor: {
        kind: "staff",
        staffProfileId,
        activationTokenSecret: ACTIVATION_SECRET,
      },
      now: NOW,
      lockSessionId,
      paymentLinkTokenSecret: "p".repeat(32),
      // Even if somehow passed, staff path must not persist client IP semantics.
      ipAddress: "203.0.113.1",
    });

    expect(result.bootstrapped).toBe(true);
    expect(result.activation?.rawToken).toMatch(/^[a-f0-9]+$/i);
    expect(result.reservationIds).toHaveLength(2);
    expect(result.acceptedBy).toEqual({
      kind: "staff",
      staffProfileId,
    });
    expect(result.acceptedBy).not.toHaveProperty("ipAddress");

    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findById(result.clientAccountId).lean().exec();
    expect(account?.status).toBe("pending_activation");
    expect(account?.status).not.toBe("locked");

    const Activation = await getClientAccountActivationModel();
    const activation = await Activation.findById(result.activation!.activationId).lean().exec();
    expect(activation?.status).toBe("pending");

    const Reservation = await getReservationModel();
    const reservations = await Reservation.find({ quoteId: quote._id }).lean().exec();
    expect(reservations).toHaveLength(2);
    for (const res of reservations) {
      expect(res.status).toBe("awaiting_payment");
      expect(res.awaitingPaymentExpiresAt?.toISOString()).toBe(VALID_UNTIL.toISOString());
      expect(res.awaitingPaymentMethod).toBe("card");
      expect(res.createdChannel).toBe("staff");
      expect(String(res.cardexId)).toBe(String(result.cardexId));
    }

    const Invoice = await getInvoiceModel();
    const invoices = await Invoice.find({ quoteId: quote._id }).lean().exec();
    expect(invoices).toHaveLength(1);
    expect(invoices[0]!.type).toBe("proforma");
    expect(invoices[0]!.reservationIds?.map(String).sort()).toEqual(
      result.reservationIds.map(String).sort(),
    );
    expect(invoices[0]!.lines).toHaveLength(3); // 2 spaces + 1 service

    const Quote = await getQuoteModel();
    const accepted = await Quote.findById(quote._id).lean().exec();
    expect(accepted?.status).toBe("accepted");
    expect(accepted?.acceptTokenHash).toBeUndefined();
    expect(accepted?.reservationIds?.map(String).sort()).toEqual(
      result.reservationIds.map(String).sort(),
    );
    expect(accepted?.acceptedBy?.kind).toBe("staff");
    expect(String(accepted?.acceptedBy?.staffProfileId)).toBe(String(staffProfileId));
    expect(accepted?.acceptedBy).not.toHaveProperty("ipAddress");

    const locks = await findActiveLocksBySessionId(lockSessionId, NOW);
    expect(locks).toHaveLength(0);
  }, 20_000);

  it("client path (existing account): accepts direct with acceptedBy.client", async () => {
    const a = await seedSpace("FOCUS");
    const mongooseInstance = await connectMongo();
    const session = await mongooseInstance.startSession();
    let clientAccountId: Types.ObjectId;
    let cardexId: Types.ObjectId;
    try {
      await session.withTransaction(async () => {
        const created = await createClientAccount({
          email: "prospect@example.com",
          password: "SecretPass1!",
          role: "owner",
          privacyPolicyVersion: "2026-07-01",
          now: NOW,
          session,
        });
        clientAccountId = created.clientAccountId;
        const Cardex = await getCardexModel();
        const ClientAccount = await getClientAccountModel();
        const [cardex] = await Cardex.create(
          [
            {
              clientAccountId,
              identity: { firstName: "Alice", lastName: "Martin" },
              documents: [],
              preferentialCodeIds: [],
              billingSummary: { depositsTotal: 0, balanceDue: 0 },
              retentionStatus: "active",
            },
          ],
          { session },
        );
        cardexId = cardex!._id;
        await ClientAccount.updateOne(
          { _id: clientAccountId },
          { $set: { cardexId } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    const quote = await seedSentQuote({
      spaceId: a.spaceId,
      buildingId: a.buildingId,
      overrides: {
        cardexId: cardexId!,
        clientAccountId: clientAccountId!,
      },
    });

    const result = await acceptQuote({
      quoteId: quote._id,
      actor: { kind: "client", clientAccountId: clientAccountId! },
      now: NOW,
      paymentLinkTokenSecret: "p".repeat(32),
      ipAddress: "203.0.113.77",
    });

    expect(result.bootstrapped).toBe(false);
    expect(result.activation).toBeUndefined();
    expect(result.acceptedBy).toEqual({
      kind: "client",
      clientAccountId: clientAccountId!,
      ipAddress: "203.0.113.77",
    });
    expect(result.reservationIds).toHaveLength(1);

    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findById(clientAccountId!).lean().exec();
    expect(account?.status).toBe("active");

    const Quote = await getQuoteModel();
    const accepted = await Quote.findById(quote._id).lean().exec();
    expect(accepted?.acceptedBy?.kind).toBe("client");
    expect(String(accepted?.acceptedBy?.clientAccountId)).toBe(String(clientAccountId!));
    expect(accepted?.acceptedBy?.ipAddress).toBe("203.0.113.77");
  });

  it("client path (no account): creates active account with chosen password then accepts", async () => {
    const a = await seedSpace("FOCUS");
    const quote = await seedSentQuote({
      spaceId: a.spaceId,
      buildingId: a.buildingId,
    });

    const result = await acceptQuote({
      quoteId: quote._id,
      actor: {
        kind: "client_register",
        password: "ChosenPass9!",
        privacyPolicyVersion: "2026-07-01",
        marketingCommunicationsAccepted: false,
      },
      now: NOW,
      paymentLinkTokenSecret: "p".repeat(32),
    });

    expect(result.bootstrapped).toBe(false);
    expect(result.acceptedBy).toEqual({
      kind: "client",
      clientAccountId: result.clientAccountId,
    });
    expect(result.acceptedBy).not.toHaveProperty("staffProfileId");

    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findById(result.clientAccountId).lean().exec();
    expect(account?.status).toBe("active");
    expect(account?.email).toBe("prospect@example.com");
    expect(account?.cardexId).toBeTruthy();

    const Quote = await getQuoteModel();
    const accepted = await Quote.findById(quote._id).lean().exec();
    expect(accepted?.acceptedBy?.kind).toBe("client");
    expect(String(accepted?.acceptedBy?.clientAccountId)).toBe(String(result.clientAccountId));
    expect(accepted?.acceptedBy).not.toHaveProperty("staffProfileId");

    const Reservation = await getReservationModel();
    const reservations = await Reservation.find({ quoteId: quote._id }).lean().exec();
    expect(reservations).toHaveLength(1);
    expect(reservations[0]!.createdChannel).toBe("online");
    expect(reservations[0]!.awaitingPaymentExpiresAt?.toISOString()).toBe(
      VALID_UNTIL.toISOString(),
    );
  });

  it("rejects expired validUntil for staff even when quote is still sent", async () => {
    const a = await seedSpace("FOCUS");
    const quote = await seedSentQuote({
      spaceId: a.spaceId,
      buildingId: a.buildingId,
      overrides: {
        validUntil: new Date("2026-07-10T00:00:00.000Z"),
      },
    });

    await expect(
      acceptQuote({
        quoteId: quote._id,
        actor: {
          kind: "staff",
          staffProfileId: new Types.ObjectId(),
          activationTokenSecret: ACTIVATION_SECRET,
        },
        now: NOW,
        paymentLinkTokenSecret: "p".repeat(32),
      }),
    ).rejects.toMatchObject({
      name: "AcceptQuoteError",
      code: "QUOTE_EXPIRED",
    });

    const Quote = await getQuoteModel();
    const still = await Quote.findById(quote._id).lean().exec();
    expect(still?.status).toBe("sent");
    const Reservation = await getReservationModel();
    await expect(Reservation.countDocuments({ quoteId: quote._id })).resolves.toBe(0);
  });

  it("rejects expired validUntil for client path", async () => {
    const a = await seedSpace("FOCUS");
    const quote = await seedSentQuote({
      spaceId: a.spaceId,
      buildingId: a.buildingId,
      overrides: {
        validUntil: new Date("2026-07-01T00:00:00.000Z"),
      },
    });

    await expect(
      acceptQuote({
        quoteId: quote._id,
        actor: {
          kind: "client_register",
          password: "ChosenPass9!",
          privacyPolicyVersion: "2026-07-01",
        },
        now: NOW,
        paymentLinkTokenSecret: "p".repeat(32),
      }),
    ).rejects.toMatchObject({ code: "QUOTE_EXPIRED" });

    const ClientAccount = await getClientAccountModel();
    await expect(ClientAccount.countDocuments()).resolves.toBe(0);
  });

  it("rejects when any space is unavailable at accept time (no partial accept)", async () => {
    const a = await seedSpace("FOCUS");
    const b = await seedSpace("OPEN");
    const quote = await seedSentQuote({
      spaceId: a.spaceId,
      buildingId: a.buildingId,
      secondSpace: { spaceId: b.spaceId, buildingId: b.buildingId },
    });

    // Block first space with an overlapping confirmed reservation.
    await createReservation({
      reference: "RES-2026-BLOCK",
      spaceId: a.spaceId,
      buildingId: a.buildingId,
      spaceSnapshot: { name: "FOCUS", type: "meeting_room" },
      type: "meeting_room",
      startAt: new Date("2026-08-10T08:00:00.000Z"),
      endAt: new Date("2026-08-10T18:00:00.000Z"),
      durationClass: "daily",
      partySize: 2,
      status: "confirmed",
      statusHistory: [{ from: "pending", to: "confirmed", at: NOW }],
      pricing: { subtotalHT: 1, totalVAT: 0, totalTTC: 1, discountTotal: 0 },
      services: [],
      createdChannel: "staff",
    });

    await expect(
      acceptQuote({
        quoteId: quote._id,
        actor: {
          kind: "staff",
          staffProfileId: new Types.ObjectId(),
          activationTokenSecret: ACTIVATION_SECRET,
        },
        now: NOW,
        paymentLinkTokenSecret: "p".repeat(32),
      }),
    ).rejects.toMatchObject({
      name: "AcceptQuoteError",
      code: "SLOT_UNAVAILABLE",
    });

    const Quote = await getQuoteModel();
    const still = await Quote.findById(quote._id).lean().exec();
    expect(still?.status).toBe("sent");
    const Reservation = await getReservationModel();
    // Only the blocker — no quote-derived reservations
    await expect(Reservation.countDocuments({ quoteId: quote._id })).resolves.toBe(0);
    const Invoice = await getInvoiceModel();
    await expect(Invoice.countDocuments({ quoteId: quote._id })).resolves.toBe(0);
    const ClientAccount = await getClientAccountModel();
    await expect(ClientAccount.countDocuments()).resolves.toBe(0);
  });

  it("rolls back when failure after quote accepted — no bastard accepted-without-resa", async () => {
    const a = await seedSpace("FOCUS");
    const quote = await seedSentQuote({
      spaceId: a.spaceId,
      buildingId: a.buildingId,
    });

    await expect(
      acceptQuote({
        quoteId: quote._id,
        actor: {
          kind: "staff",
          staffProfileId: new Types.ObjectId(),
          activationTokenSecret: ACTIVATION_SECRET,
        },
        now: NOW,
        simulateFailureAfter: "quote_accepted",
        paymentLinkTokenSecret: "p".repeat(32),
      }),
    ).rejects.toThrow(/SIMULATED_ACCEPT_FAILURE_AFTER_QUOTE_ACCEPTED/);

    const Quote = await getQuoteModel();
    const still = await Quote.findById(quote._id).lean().exec();
    expect(still?.status).toBe("sent");
    expect(still?.acceptedAt).toBeUndefined();

    const Reservation = await getReservationModel();
    await expect(Reservation.countDocuments()).resolves.toBe(0);
    const Invoice = await getInvoiceModel();
    await expect(Invoice.countDocuments()).resolves.toBe(0);
    const ClientAccount = await getClientAccountModel();
    await expect(ClientAccount.countDocuments()).resolves.toBe(0);
    const Cardex = await getCardexModel();
    await expect(Cardex.countDocuments()).resolves.toBe(0);
  });

  it("rolls back when failure after reservations — no orphan resa without invoice", async () => {
    const a = await seedSpace("FOCUS");
    const quote = await seedSentQuote({
      spaceId: a.spaceId,
      buildingId: a.buildingId,
    });

    await expect(
      acceptQuote({
        quoteId: quote._id,
        actor: {
          kind: "staff",
          staffProfileId: new Types.ObjectId(),
          activationTokenSecret: ACTIVATION_SECRET,
        },
        now: NOW,
        simulateFailureAfter: "reservations_created",
        paymentLinkTokenSecret: "p".repeat(32),
      }),
    ).rejects.toThrow(/SIMULATED_ACCEPT_FAILURE_AFTER_RESERVATIONS/);

    const Quote = await getQuoteModel();
    const still = await Quote.findById(quote._id).lean().exec();
    expect(still?.status).toBe("sent");

    const Reservation = await getReservationModel();
    await expect(Reservation.countDocuments()).resolves.toBe(0);
    const Invoice = await getInvoiceModel();
    await expect(Invoice.countDocuments()).resolves.toBe(0);
  });

  it("rolls back when failure after invoice create (before quote reservationIds link)", async () => {
    const a = await seedSpace("FOCUS");
    const quote = await seedSentQuote({
      spaceId: a.spaceId,
      buildingId: a.buildingId,
    });

    await expect(
      acceptQuote({
        quoteId: quote._id,
        actor: {
          kind: "client_register",
          password: "ChosenPass9!",
          privacyPolicyVersion: "2026-07-01",
        },
        now: NOW,
        simulateFailureAfter: "invoice_created",
        paymentLinkTokenSecret: "p".repeat(32),
      }),
    ).rejects.toThrow(/SIMULATED_ACCEPT_FAILURE_AFTER_INVOICE/);

    const Quote = await getQuoteModel();
    const still = await Quote.findById(quote._id).lean().exec();
    expect(still?.status).toBe("sent");
    const Reservation = await getReservationModel();
    await expect(Reservation.countDocuments()).resolves.toBe(0);
    const Invoice = await getInvoiceModel();
    await expect(Invoice.countDocuments()).resolves.toBe(0);
    const ClientAccount = await getClientAccountModel();
    await expect(ClientAccount.countDocuments()).resolves.toBe(0);
  });

  it("rejects non-sent status", async () => {
    const a = await seedSpace("FOCUS");
    const quote = await seedSentQuote({
      spaceId: a.spaceId,
      buildingId: a.buildingId,
      overrides: { status: "draft" },
    });

    await expect(
      acceptQuote({
        quoteId: quote._id,
        actor: {
          kind: "staff",
          staffProfileId: new Types.ObjectId(),
          activationTokenSecret: ACTIVATION_SECRET,
        },
        now: NOW,
        paymentLinkTokenSecret: "p".repeat(32),
      }),
    ).rejects.toBeInstanceOf(AcceptQuoteError);
  });
});
