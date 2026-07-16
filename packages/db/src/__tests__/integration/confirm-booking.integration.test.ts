import { hash } from "bcryptjs";
import { Types } from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { connectMongo, getCoworkDb } from "../../connection.js";
import {
  clientAccountEmailExists,
  confirmBookingCheckout,
  verifyClientAccountCredentials,
} from "../../domains/booking/index.js";
import {
  getCardexModel,
  getClientAccountModel,
  registerCardexModel,
  registerClientAccountModel,
} from "../../domains/client/index.js";
import { getInvoiceModel, registerInvoiceModel } from "../../domains/billing/invoice.schema.js";
import {
  acquireLock,
  createReservation,
  ensureReservationIndexes,
  getReservationModel,
  registerReservationModel,
  registerSlotLockModel,
} from "../../domains/reservation/index.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  LockNotAvailableError,
  ReservationOverlapError,
} from "../../lib/errors.js";
import { registerReferenceSequenceModel } from "../../lib/reference-sequences.js";
import {
  clearCoworkCollections,
  configureIntegrationEnv,
  startIntegrationMongo,
  stopIntegrationMongo,
} from "./setup.js";

const BASE_PRICING = {
  subtotalHT: 5000,
  discountTotal: 0,
  vatBreakdown: [{ rate: 20, baseHT: 5000, vat: 1000 }],
  totalTTC: 6000,
  lines: [
    {
      label: "Salle A",
      kind: "space" as const,
      qty: 1,
      unitPriceHT: 5000,
      vatRate: 20,
      discount: 0,
      totalHT: 5000,
      totalVAT: 1000,
      totalTTC: 6000,
    },
  ],
};

function buildConfirmInput(
  lockId: Types.ObjectId,
  sessionId: string,
  spaceId: Types.ObjectId,
  buildingId: Types.ObjectId,
  overrides: Partial<Parameters<typeof confirmBookingCheckout>[0]> = {},
) {
  const startAt = new Date("2026-07-01T10:00:00.000Z");
  const endAt = new Date("2026-07-01T11:00:00.000Z");

  return {
    lockId,
    sessionId,
    spaceId,
    buildingId,
    startAt,
    endAt,
    durationClass: "hourly" as const,
    partySize: 4,
    reservationType: "meeting_room" as const,
    spaceSnapshot: { name: "Salle A", type: "meeting_room" },
    services: [],
    accountMode: "new" as const,
    email: "client@example.com",
    password: "SecretPass1!",
    identity: { firstName: "Jean", lastName: "Dupont", phone: "0612345678" },
    privacyPolicyVersion: "2026-07-09",
    cgvAcceptedAt: new Date("2026-07-01T09:00:00.000Z"),
    withdrawalAcknowledgedAt: new Date("2026-07-01T09:00:00.000Z"),
    paymentMethod: "proforma" as const,
    pricing: BASE_PRICING,
    ...overrides,
  };
}

describe("integration: confirm booking checkout (replica set)", () => {
  beforeAll(async () => {
    const uri = await startIntegrationMongo();
    await configureIntegrationEnv(uri);
    await connectMongo();
    const connection = await getCoworkDb();
    registerSlotLockModel(connection);
    registerReservationModel(connection);
    registerClientAccountModel(connection);
    registerCardexModel(connection);
    registerInvoiceModel(connection);
    registerReferenceSequenceModel(connection);
    await ensureReservationIndexes();
  }, 120_000);

  afterEach(async () => {
    await clearCoworkCollections();
  });

  afterAll(async () => {
    await stopIntegrationMongo();
  });

  it("abandon before confirm leaves no account, reservation, or invoice traces", async () => {
    const spaceId = new Types.ObjectId();
    const startAt = new Date("2026-07-01T10:00:00.000Z");
    const endAt = new Date("2026-07-01T11:00:00.000Z");

    await acquireLock({ spaceId, startAt, endAt, sessionId: "abandon-session" });

    const ClientAccount = await getClientAccountModel();
    const Reservation = await getReservationModel();
    const Invoice = await getInvoiceModel();
    const Cardex = await getCardexModel();

    await expect(ClientAccount.countDocuments()).resolves.toBe(0);
    await expect(Reservation.countDocuments()).resolves.toBe(0);
    await expect(Invoice.countDocuments()).resolves.toBe(0);
    await expect(Cardex.countDocuments()).resolves.toBe(0);
  });

  it("creates account, cardex, reservation, and invoice together for a new client", async () => {
    const spaceId = new Types.ObjectId();
    const buildingId = new Types.ObjectId();
    const sessionId = "new-client-session";
    const startAt = new Date("2026-07-01T10:00:00.000Z");
    const endAt = new Date("2026-07-01T11:00:00.000Z");

    const lock = await acquireLock({ spaceId, startAt, endAt, sessionId });
    const result = await confirmBookingCheckout(
      buildConfirmInput(lock._id, sessionId, spaceId, buildingId),
    );

    expect(result.isNewAccount).toBe(true);
    expect(result.reservation.reference).toMatch(/^RES-2026-\d{5}$/);
    expect(result.invoiceReference).toMatch(/^PF-2026-\d{5}$/);

    const ClientAccount = await getClientAccountModel();
    const Cardex = await getCardexModel();
    const Reservation = await getReservationModel();
    const Invoice = await getInvoiceModel();

    await expect(ClientAccount.countDocuments()).resolves.toBe(1);
    await expect(Cardex.countDocuments()).resolves.toBe(1);
    await expect(Reservation.countDocuments()).resolves.toBe(1);
    await expect(Invoice.countDocuments()).resolves.toBe(1);

    const account = await ClientAccount.findOne({ email: "client@example.com" }).lean().exec();
    expect(account?.cardexId?.toString()).toBe(result.cardexId.toString());
    expect(account?.marketingConsent).toEqual({ accepted: false });
  });

  it("persists opted-in marketing consent on new client account", async () => {
    const spaceId = new Types.ObjectId();
    const buildingId = new Types.ObjectId();
    const sessionId = "marketing-opt-in-session";
    const startAt = new Date("2026-07-01T10:00:00.000Z");
    const endAt = new Date("2026-07-01T11:00:00.000Z");

    const lock = await acquireLock({ spaceId, startAt, endAt, sessionId });
    await confirmBookingCheckout(
      buildConfirmInput(lock._id, sessionId, spaceId, buildingId, {
        email: "marketing@example.com",
        marketingCommunicationsAccepted: true,
      }),
    );

    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findOne({ email: "marketing@example.com" }).lean().exec();
    expect(account?.marketingConsent?.accepted).toBe(true);
    expect(account?.marketingConsent?.acceptedAt).toBeInstanceOf(Date);
  });

  it("rolls back completely when overlap is detected at confirm time", async () => {
    const spaceId = new Types.ObjectId();
    const buildingId = new Types.ObjectId();
    const sessionId = "overlap-session";
    const startAt = new Date("2026-07-01T10:00:00.000Z");
    const endAt = new Date("2026-07-01T11:00:00.000Z");

    await createReservation({
      reference: "RES-2026-00001",
      spaceId,
      spaceSnapshot: { name: "Salle A", type: "meeting_room" },
      buildingId,
      type: "meeting_room",
      startAt,
      endAt,
      durationClass: "hourly",
      partySize: 4,
      status: "confirmed",
      statusHistory: [],
      services: [],
      pricing: { subtotalHT: 5000, totalVAT: 1000, totalTTC: 6000, discountTotal: 0 },
      createdChannel: "online",
    });

    const lock = await acquireLock({ spaceId, startAt, endAt, sessionId });

    await expect(
      confirmBookingCheckout(buildConfirmInput(lock._id, sessionId, spaceId, buildingId)),
    ).rejects.toBeInstanceOf(ReservationOverlapError);

    const ClientAccount = await getClientAccountModel();
    const Cardex = await getCardexModel();
    const Reservation = await getReservationModel();
    const Invoice = await getInvoiceModel();

    await expect(ClientAccount.countDocuments()).resolves.toBe(0);
    await expect(Cardex.countDocuments()).resolves.toBe(0);
    await expect(Reservation.countDocuments()).resolves.toBe(1);
    await expect(Invoice.countDocuments()).resolves.toBe(0);
  });

  it("rejects existing account with wrong password and creates nothing", async () => {
    const spaceId = new Types.ObjectId();
    const buildingId = new Types.ObjectId();
    const sessionId = "wrong-password-session";
    const startAt = new Date("2026-07-01T10:00:00.000Z");
    const endAt = new Date("2026-07-01T11:00:00.000Z");

    const ClientAccount = await getClientAccountModel();
    await ClientAccount.create({
      email: "existing@example.com",
      passwordHash: await hash("CorrectPass1!", 12),
      consent: { privacyPolicyVersion: "2026-07-09", acceptedAt: new Date() },
      status: "active",
    });

    const lock = await acquireLock({ spaceId, startAt, endAt, sessionId });

    await expect(
      confirmBookingCheckout(
        buildConfirmInput(lock._id, sessionId, spaceId, buildingId, {
          accountMode: "existing",
          email: "existing@example.com",
          password: "WrongPass1!",
          identity: undefined,
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    const Reservation = await getReservationModel();
    const Invoice = await getInvoiceModel();

    await expect(ClientAccount.countDocuments()).resolves.toBe(1);
    await expect(Reservation.countDocuments()).resolves.toBe(0);
    await expect(Invoice.countDocuments()).resolves.toBe(0);
  });

  it("allows only one successful confirm when two requests share the same lock", async () => {
    const spaceId = new Types.ObjectId();
    const buildingId = new Types.ObjectId();
    const sessionId = "double-submit-session";
    const startAt = new Date("2026-07-01T10:00:00.000Z");
    const endAt = new Date("2026-07-01T11:00:00.000Z");

    const lock = await acquireLock({ spaceId, startAt, endAt, sessionId });
    const input = buildConfirmInput(lock._id, sessionId, spaceId, buildingId, {
      email: "double@example.com",
    });

    const results = await Promise.allSettled([
      confirmBookingCheckout(input),
      confirmBookingCheckout(input),
    ]);

    const fulfilled = results.filter((entry) => entry.status === "fulfilled");
    const rejected = results.filter((entry) => entry.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(LockNotAvailableError);

    const Reservation = await getReservationModel();
    await expect(Reservation.countDocuments()).resolves.toBe(1);
  });

  it("verifyClientAccountCredentials and clientAccountEmailExists behave correctly", async () => {
    const ClientAccount = await getClientAccountModel();
    await ClientAccount.create({
      email: "verify@example.com",
      passwordHash: await hash("VerifyPass1!", 12),
      consent: { privacyPolicyVersion: "2026-07-09", acceptedAt: new Date() },
      status: "active",
    });

    await expect(clientAccountEmailExists("verify@example.com")).resolves.toBe(true);
    await expect(clientAccountEmailExists("missing@example.com")).resolves.toBe(false);
    await expect(
      verifyClientAccountCredentials("verify@example.com", "VerifyPass1!"),
    ).resolves.toBe(true);
    await expect(verifyClientAccountCredentials("verify@example.com", "WrongPass1!")).resolves.toBe(
      false,
    );
  });

  it("rejects duplicate email registration for a new account", async () => {
    const spaceId = new Types.ObjectId();
    const buildingId = new Types.ObjectId();
    const sessionId = "duplicate-email-session";
    const startAt = new Date("2026-07-01T10:00:00.000Z");
    const endAt = new Date("2026-07-01T11:00:00.000Z");

    const ClientAccount = await getClientAccountModel();
    await ClientAccount.create({
      email: "taken@example.com",
      passwordHash: await hash("ExistingPass1!", 12),
      consent: { privacyPolicyVersion: "2026-07-09", acceptedAt: new Date() },
      status: "active",
    });

    const lock = await acquireLock({ spaceId, startAt, endAt, sessionId });

    await expect(
      confirmBookingCheckout(
        buildConfirmInput(lock._id, sessionId, spaceId, buildingId, {
          email: "taken@example.com",
        }),
      ),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });
});
