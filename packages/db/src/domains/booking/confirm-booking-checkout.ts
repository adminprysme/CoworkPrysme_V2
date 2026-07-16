import { compare, hash } from "bcryptjs";
import type { ClientSession, Types } from "mongoose";

import { connectMongo } from "../../connection.js";
import { getCardexModel, getClientAccountModel } from "../client/index.js";
import { getInvoiceModel } from "../billing/invoice.schema.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  isDuplicateKeyError,
  LockMismatchError,
  LockNotAvailableError,
  ReservationOverlapError,
} from "../../lib/errors.js";
import { AWAITING_PAYMENT_TTL_MS } from "../../lib/enums.js";
import { nextReference } from "../../lib/reference-sequences.js";
import { assertReplicaSetForTransactions } from "../../lib/replica-set.js";
import type { CardexIdentity } from "../../lib/subdocuments.js";
import type { BookingPriceResponse } from "@coworkprysme/shared";
import { findOverlappingReservation } from "../reservation/availability.js";
import {
  getReservationModel,
  type Reservation,
  type ReservationDocument,
} from "../reservation/reservation.schema.js";
import { getSlotLockModel, type SlotLock } from "../reservation/slot-lock.schema.js";

const BCRYPT_ROUNDS = 12;

export interface ConfirmBookingCheckoutInput {
  lockId: Types.ObjectId | string;
  sessionId: string;
  spaceId: Types.ObjectId;
  buildingId: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  durationClass: Reservation["durationClass"];
  partySize: number;
  reservationType: Reservation["type"];
  spaceSnapshot: Reservation["spaceSnapshot"];
  services: Reservation["services"];
  discountCodeId?: Types.ObjectId;
  accountMode: "new" | "existing";
  email: string;
  password: string;
  identity?: CardexIdentity;
  privacyPolicyVersion?: string;
  marketingCommunicationsAccepted?: boolean;
  cgvAcceptedAt: Date;
  withdrawalAcknowledgedAt: Date;
  paymentMethod: "proforma" | "card";
  pricing: BookingPriceResponse;
  now?: Date;
}

export interface ConfirmBookingCheckoutResult {
  reservation: ReservationDocument;
  invoiceReference: string;
  clientAccountId: Types.ObjectId;
  cardexId: Types.ObjectId;
  isNewAccount: boolean;
  clientEmail: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function lockMatchesRequest(
  lock: Pick<SlotLock, "spaceId" | "startAt" | "endAt">,
  input: ConfirmBookingCheckoutInput,
): boolean {
  return (
    lock.spaceId.toString() === input.spaceId.toString() &&
    lock.startAt.getTime() === input.startAt.getTime() &&
    lock.endAt.getTime() === input.endAt.getTime()
  );
}

function mapPricingToReservationSnapshot(pricing: BookingPriceResponse) {
  const totalVAT = pricing.vatBreakdown.reduce((sum, line) => sum + line.vat, 0);
  return {
    subtotalHT: pricing.subtotalHT,
    totalVAT,
    totalTTC: pricing.totalTTC,
    discountTotal: pricing.discountTotal,
  };
}

function mapPricingToInvoiceLines(pricing: BookingPriceResponse) {
  return pricing.lines.map((line) => ({
    label: line.label,
    kind: line.kind,
    qty: line.qty,
    unitPriceHT: line.unitPriceHT,
    vatRate: line.vatRate,
    discount: line.discount,
    totalHT: line.totalHT,
    totalVAT: line.totalVAT,
    totalTTC: line.totalTTC,
  }));
}

async function consumeLock(
  input: ConfirmBookingCheckoutInput,
  now: Date,
  session: ClientSession,
): Promise<SlotLock & { _id: Types.ObjectId }> {
  const SlotLock = await getSlotLockModel();
  const lock = await SlotLock.findOneAndDelete(
    {
      _id: input.lockId,
      sessionId: input.sessionId,
      expiresAt: { $gte: now },
    },
    { session },
  )
    .lean<SlotLock & { _id: Types.ObjectId }>()
    .exec();

  if (!lock) {
    throw new LockNotAvailableError();
  }

  if (!lockMatchesRequest(lock, input)) {
    throw new LockMismatchError();
  }

  return lock;
}

async function resolveClientAccount(
  input: ConfirmBookingCheckoutInput,
  now: Date,
  session: ClientSession,
): Promise<{ clientAccountId: Types.ObjectId; cardexId?: Types.ObjectId; isNewAccount: boolean }> {
  const ClientAccount = await getClientAccountModel();
  const normalizedEmail = normalizeEmail(input.email);

  if (input.accountMode === "existing") {
    const existing = await ClientAccount.findOne({
      email: normalizedEmail,
      status: "active",
    })
      .session(session)
      .exec();

    if (!existing) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await compare(input.password, existing.passwordHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    return {
      clientAccountId: existing._id,
      cardexId: existing.cardexId ?? undefined,
      isNewAccount: false,
    };
  }

  const passwordHash = await hash(input.password, BCRYPT_ROUNDS);

  const existingEmail = await ClientAccount.findOne({ email: normalizedEmail })
    .session(session)
    .select({ _id: 1 })
    .lean()
    .exec();
  if (existingEmail) {
    throw new EmailAlreadyRegisteredError();
  }

  try {
    const [created] = await ClientAccount.create(
      [
        {
          email: normalizedEmail,
          passwordHash,
          consent: {
            privacyPolicyVersion: input.privacyPolicyVersion ?? "unknown",
            acceptedAt: now,
          },
          marketingConsent: {
            accepted: input.marketingCommunicationsAccepted === true,
            ...(input.marketingCommunicationsAccepted === true ? { acceptedAt: now } : {}),
          },
          status: "active",
        },
      ],
      { session },
    );

    if (!created) {
      throw new Error("Client account creation failed within transaction");
    }

    return {
      clientAccountId: created._id,
      isNewAccount: true,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new EmailAlreadyRegisteredError();
    }
    throw error;
  }
}

async function ensureCardex(
  clientAccountId: Types.ObjectId,
  existingCardexId: Types.ObjectId | undefined,
  identity: CardexIdentity | undefined,
  now: Date,
  session: ClientSession,
): Promise<Types.ObjectId> {
  if (existingCardexId) {
    return existingCardexId;
  }

  if (!identity) {
    throw new Error("Cardex identity is required for the first reservation");
  }

  const Cardex = await getCardexModel();
  const ClientAccount = await getClientAccountModel();

  const [cardex] = await Cardex.create(
    [
      {
        clientAccountId,
        identity,
        documents: [],
        preferentialCodeIds: [],
        billingSummary: { depositsTotal: 0, balanceDue: 0 },
        retentionStatus: "active",
        lastReservationAt: now,
      },
    ],
    { session },
  );

  if (!cardex) {
    throw new Error("Cardex creation failed within transaction");
  }

  await ClientAccount.updateOne({ _id: clientAccountId }, { cardexId: cardex._id }, { session });

  return cardex._id;
}

/**
 * Atomically creates or reuses a client account, cardex (if needed), reservation,
 * proforma invoice, and consumes the booking lock.
 */
export async function confirmBookingCheckout(
  input: ConfirmBookingCheckoutInput,
): Promise<ConfirmBookingCheckoutResult> {
  const mongooseInstance = await connectMongo();
  await assertReplicaSetForTransactions(mongooseInstance.connection);

  const now = input.now ?? new Date();
  const session = await mongooseInstance.startSession();
  let result: ConfirmBookingCheckoutResult | undefined;

  try {
    await session.withTransaction(async () => {
      await consumeLock(input, now, session);

      const account = await resolveClientAccount(input, now, session);
      const cardexId = await ensureCardex(
        account.clientAccountId,
        account.cardexId,
        input.identity,
        now,
        session,
      );

      const overlap = await findOverlappingReservation(
        input.spaceId,
        input.startAt,
        input.endAt,
        session,
      );
      if (overlap) {
        throw new ReservationOverlapError();
      }

      const reservationReference = await nextReference("RES", session, now);
      const invoiceReference = await nextReference("PF", session, now);
      const pricingSnapshot = mapPricingToReservationSnapshot(input.pricing);
      const totalVAT = pricingSnapshot.totalVAT;

      // Card: hold slot as awaiting_payment until Stripe confirms; proforma: confirmed now.
      const isCard = input.paymentMethod === "card";
      const reservationStatus = isCard ? ("awaiting_payment" as const) : ("confirmed" as const);
      const statusHistory = isCard
        ? [
            {
              from: "pending",
              to: "awaiting_payment",
              at: now,
              reason: "card_checkout",
            },
          ]
        : [{ from: "pending", to: "confirmed", at: now }];

      const Reservation = await getReservationModel();
      const [reservation] = await Reservation.create(
        [
          {
            reference: reservationReference,
            spaceId: input.spaceId,
            spaceSnapshot: input.spaceSnapshot,
            buildingId: input.buildingId,
            clientAccountId: account.clientAccountId,
            cardexId,
            type: input.reservationType,
            startAt: input.startAt,
            endAt: input.endAt,
            durationClass: input.durationClass,
            partySize: input.partySize,
            status: reservationStatus,
            statusHistory,
            services: input.services,
            discountCodeId: input.discountCodeId,
            pricing: pricingSnapshot,
            cgvAcceptedAt: input.cgvAcceptedAt,
            withdrawalAcknowledgedAt: input.withdrawalAcknowledgedAt,
            ...(isCard
              ? {
                  awaitingPaymentExpiresAt: new Date(now.getTime() + AWAITING_PAYMENT_TTL_MS),
                }
              : {}),
            createdChannel: "online",
          },
        ],
        { session },
      );

      if (!reservation) {
        throw new Error("Reservation creation failed within transaction");
      }

      const Cardex = await getCardexModel();
      await Cardex.updateOne({ _id: cardexId }, { lastReservationAt: now }, { session });

      const Invoice = await getInvoiceModel();
      await Invoice.create(
        [
          {
            reference: invoiceReference,
            type: "proforma",
            cardexId,
            reservationId: reservation._id,
            lines: mapPricingToInvoiceLines(input.pricing),
            vatBreakdown: input.pricing.vatBreakdown.map((line) => ({
              rate: line.rate,
              baseHT: line.baseHT,
              vat: line.vat,
            })),
            totals: {
              ht: input.pricing.subtotalHT,
              vat: totalVAT,
              ttc: input.pricing.totalTTC,
              discountTotal: input.pricing.discountTotal,
              paidTotal: 0,
              balanceDue: input.pricing.totalTTC,
            },
            paymentSituation: input.paymentMethod === "card" ? "immediate" : "on_quote",
            status: "proforma",
            issuedAt: now,
          },
        ],
        { session },
      );

      result = {
        reservation,
        invoiceReference,
        clientAccountId: account.clientAccountId,
        cardexId,
        isNewAccount: account.isNewAccount,
        clientEmail: normalizeEmail(input.email),
      };
    });

    if (!result) {
      throw new Error("Booking confirm failed within transaction");
    }

    return result;
  } finally {
    await session.endSession();
  }
}

/** Verifies client credentials without creating a session. */
export async function verifyClientAccountCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  await connectMongo();
  const ClientAccount = await getClientAccountModel();
  const normalizedEmail = normalizeEmail(email);
  const account = await ClientAccount.findOne({ email: normalizedEmail, status: "active" })
    .lean()
    .exec();

  if (!account) {
    return false;
  }

  return compare(password, account.passwordHash);
}

/** Returns whether an active client account exists for the email. */
export async function clientAccountEmailExists(email: string): Promise<boolean> {
  await connectMongo();
  const ClientAccount = await getClientAccountModel();
  const normalizedEmail = normalizeEmail(email);
  const account = await ClientAccount.findOne({ email: normalizedEmail, status: "active" })
    .select({ _id: 1 })
    .lean()
    .exec();
  return account !== null;
}
