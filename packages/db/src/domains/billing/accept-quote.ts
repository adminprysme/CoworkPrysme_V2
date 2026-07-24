import type { ClientSession, Types } from "mongoose";

import { connectMongo } from "../../connection.js";
import { EmailAlreadyRegisteredError, ReservationOverlapError } from "../../lib/errors.js";
import { nextReference } from "../../lib/reference-sequences.js";
import { assertReplicaSetForTransactions } from "../../lib/replica-set.js";
import type {
  QuoteAcceptedBy,
  QuoteLine,
  QuoteProspect,
  SpaceSnapshot,
} from "../../lib/subdocuments.js";
import { getCardexModel } from "../client/cardex.schema.js";
import { getClientAccountModel } from "../client/client-account.schema.js";
import { normalizeClientEmail } from "../client/create-client-account.js";
import { findOverlappingReservation } from "../reservation/availability.js";
import { releaseLocksBySessionId } from "../reservation/locks.js";
import { getReservationModel } from "../reservation/reservation.schema.js";
import { getSpaceModel } from "../structure/space.schema.js";
import {
  bootstrapQuoteClientFromProspect,
  QuoteBootstrapError,
  resolveProspectIdentity,
} from "./bootstrap-quote-client.js";
import { getInvoiceModel } from "./invoice.schema.js";
import { getQuoteModel, type Quote } from "./quote.schema.js";
import { registerClientAccountForQuoteAccept } from "./register-for-quote-accept.js";

export type AcceptQuoteErrorCode =
  | "QUOTE_NOT_FOUND"
  | "QUOTE_INVALID_STATUS"
  | "QUOTE_EXPIRED"
  | "QUOTE_NO_SPACE_LINES"
  | "SLOT_UNAVAILABLE"
  | "PROSPECT_REQUIRED"
  | "PROSPECT_IDENTITY_INCOMPLETE"
  | "ACCOUNT_REQUIRED"
  | "ACCOUNT_INVALID"
  | "ACCOUNT_ALREADY_EXISTS"
  | "SPACE_NOT_FOUND";

export class AcceptQuoteError extends Error {
  readonly code: AcceptQuoteErrorCode;

  constructor(code: AcceptQuoteErrorCode, message: string) {
    super(message);
    this.name = "AcceptQuoteError";
    this.code = code;
  }
}

export type AcceptQuoteActor =
  | {
      kind: "staff";
      staffProfileId: Types.ObjectId;
      /** Required when bootstrap may create `pending_activation` account. */
      activationTokenSecret: string;
    }
  | {
      kind: "client";
      /** Existing active account (path: already registered). */
      clientAccountId: Types.ObjectId;
    }
  | {
      kind: "client_register";
      /** Create active account with chosen password inside the accept txn. */
      password: string;
      privacyPolicyVersion: string;
      marketingCommunicationsAccepted?: boolean;
    };

export interface AcceptQuoteInput {
  quoteId: Types.ObjectId;
  actor: AcceptQuoteActor;
  now?: Date;
  /**
   * Wizard lock session id (`staff-quote:{staffProfileId}:{quoteId}`) to release
   * after a successful commit.
   */
  lockSessionId?: string;
  /**
   * Test/proof hook: throw inside the transaction after the named step to verify
   * rollback leaves no bastard state. Never enable in production.
   */
  simulateFailureAfter?: "quote_accepted" | "reservations_created" | "invoice_created";
}

export interface AcceptQuoteResult {
  quoteId: Types.ObjectId;
  reference: string;
  reservationIds: Types.ObjectId[];
  invoiceId: Types.ObjectId;
  invoiceReference: string;
  cardexId: Types.ObjectId;
  clientAccountId: Types.ObjectId;
  acceptedBy: QuoteAcceptedBy;
  /** True when staff path bootstrapped Cardex + pending_activation account. */
  bootstrapped: boolean;
  /** Present only when a new pending_activation account was created (staff). */
  activation?: {
    rawToken: string;
    expiresAt: Date;
    activationId: Types.ObjectId;
  };
}

interface SpaceLineContext {
  line: QuoteLine;
  spaceId: Types.ObjectId;
  buildingId: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  spaceSnapshot: SpaceSnapshot;
  reservationType: "meeting_room" | "private_office";
}

/**
 * Unified quote acceptance (Option A + A1).
 * Both staff « Devis accepté » and client self-service call this single domain function.
 *
 * Atomically: Quote.status=accepted + N Reservation(awaiting_payment) + 1 proforma Invoice
 * + optional staff bootstrap (Cardex + pending_activation) — all-or-nothing.
 */
export async function acceptQuote(input: AcceptQuoteInput): Promise<AcceptQuoteResult> {
  const mongooseInstance = await connectMongo();
  await assertReplicaSetForTransactions(mongooseInstance.connection);

  const now = input.now ?? new Date();
  const session = await mongooseInstance.startSession();
  let result: AcceptQuoteResult | undefined;

  try {
    await session.withTransaction(async () => {
      result = await acceptQuoteInTransaction(input, now, session);
    });

    if (!result) {
      throw new Error("Accept quote failed within transaction");
    }

    if (input.lockSessionId) {
      await releaseLocksBySessionId(input.lockSessionId);
    }

    return result;
  } finally {
    await session.endSession();
  }
}

async function acceptQuoteInTransaction(
  input: AcceptQuoteInput,
  now: Date,
  session: ClientSession,
): Promise<AcceptQuoteResult> {
  const Quote = await getQuoteModel();
  const quote = await Quote.findById(input.quoteId).session(session).exec();
  if (!quote) {
    throw new AcceptQuoteError("QUOTE_NOT_FOUND", "Devis introuvable.");
  }

  if (quote.status !== "sent") {
    throw new AcceptQuoteError(
      "QUOTE_INVALID_STATUS",
      quote.status === "accepted"
        ? "Ce devis a déjà été accepté."
        : "Ce devis n'est plus acceptable.",
    );
  }

  // validUntil gate — applies to BOTH client and staff, even with a still-valid accept token.
  if (quote.validUntil.getTime() < now.getTime()) {
    throw new AcceptQuoteError("QUOTE_EXPIRED", "Ce devis a expiré.");
  }

  const spaceLines = extractSpaceLines(quote.lines);
  if (spaceLines.length === 0) {
    throw new AcceptQuoteError(
      "QUOTE_NO_SPACE_LINES",
      "Le devis doit contenir au moins une ligne espace pour être accepté.",
    );
  }

  const { cardexId, clientAccountId, bootstrapped, activation, acceptedBy } = await resolveParties(
    quote,
    input.actor,
    now,
    session,
  );

  const spaceContexts = await loadSpaceContexts(spaceLines, session);

  // Re-check availability AT accept time (not only wizard).
  for (const ctx of spaceContexts) {
    const overlap = await findOverlappingReservation(ctx.spaceId, ctx.startAt, ctx.endAt, session);
    if (overlap) {
      throw new AcceptQuoteError(
        "SLOT_UNAVAILABLE",
        `Le créneau « ${ctx.spaceSnapshot.name} » n'est plus disponible.`,
      );
    }
  }

  const updated = await Quote.findOneAndUpdate(
    { _id: quote._id, status: "sent" },
    {
      $set: {
        status: "accepted",
        acceptedAt: now,
        acceptedBy,
        cardexId,
        clientAccountId,
      },
      $unset: {
        acceptTokenHash: 1,
        acceptTokenExpiresAt: 1,
      },
    },
    { session, returnDocument: "after" },
  ).exec();

  if (!updated) {
    throw new AcceptQuoteError(
      "QUOTE_INVALID_STATUS",
      "Ce devis a déjà été accepté ou n'est plus acceptable.",
    );
  }

  if (input.simulateFailureAfter === "quote_accepted") {
    throw new Error("SIMULATED_ACCEPT_FAILURE_AFTER_QUOTE_ACCEPTED");
  }

  const paymentMethod = mapAwaitingPaymentMethod(quote.paymentMethodPreferred);
  const Reservation = await getReservationModel();
  const reservationIds: Types.ObjectId[] = [];

  for (const ctx of spaceContexts) {
    const reservationReference = await nextReference("RES", session, now);
    const createdChannel = input.actor.kind === "staff" ? ("staff" as const) : ("online" as const);
    const [reservation] = await Reservation.create(
      [
        {
          reference: reservationReference,
          spaceId: ctx.spaceId,
          spaceSnapshot: ctx.spaceSnapshot,
          buildingId: ctx.buildingId,
          clientAccountId,
          cardexId,
          quoteId: quote._id,
          type: ctx.reservationType,
          startAt: ctx.startAt,
          endAt: ctx.endAt,
          durationClass: ctx.line.durationClass ?? "daily",
          partySize: ctx.line.partySize ?? 1,
          status: "awaiting_payment",
          statusHistory: [
            {
              from: "pending",
              to: "awaiting_payment",
              at: now,
              reason: "quote_accept",
            },
          ],
          services: [],
          pricing: {
            subtotalHT: ctx.line.totalHT,
            totalVAT: ctx.line.totalVAT,
            totalTTC: ctx.line.totalTTC,
            discountTotal: ctx.line.discount,
          },
          awaitingPaymentExpiresAt: quote.validUntil,
          awaitingPaymentMethod: paymentMethod,
          ...(paymentMethod === "bank_transfer" ? { bankTransferRemindersSent: [] as const } : {}),
          createdChannel,
        },
      ],
      { session },
    );

    if (!reservation) {
      throw new Error("Reservation creation failed within accept quote transaction");
    }
    reservationIds.push(reservation._id);
  }

  if (input.simulateFailureAfter === "reservations_created") {
    throw new Error("SIMULATED_ACCEPT_FAILURE_AFTER_RESERVATIONS");
  }

  const invoiceReference = await nextReference("PF", session, now);
  const Invoice = await getInvoiceModel();
  const paymentSituation =
    quote.paymentSituation ?? (quote.depositPercent > 0 ? "deposit" : "on_quote");

  const [invoice] = await Invoice.create(
    [
      {
        reference: invoiceReference,
        type: "proforma",
        cardexId,
        reservationId: reservationIds[0],
        quoteId: quote._id,
        reservationIds,
        lines: quote.lines.map((line) => ({
          label: line.label,
          kind: line.kind,
          qty: line.qty,
          unitPriceHT: line.unitPriceHT,
          vatRate: line.vatRate,
          discount: line.discount,
          totalHT: line.totalHT,
          totalVAT: line.totalVAT,
          totalTTC: line.totalTTC,
        })),
        vatBreakdown: quote.vatBreakdown.map((row) => ({
          rate: row.rate,
          baseHT: row.baseHT,
          vat: row.vat,
        })),
        totals: {
          ht: quote.totals.ht,
          vat: quote.totals.vat,
          ttc: quote.totals.ttc,
          discountTotal: quote.totals.discountTotal,
          paidTotal: 0,
          balanceDue: quote.totals.ttc,
        },
        paymentSituation,
        status: "proforma",
        issuedAt: now,
        dueDate: quote.validUntil,
      },
    ],
    { session },
  );

  if (!invoice) {
    throw new Error("Invoice creation failed within accept quote transaction");
  }

  if (input.simulateFailureAfter === "invoice_created") {
    throw new Error("SIMULATED_ACCEPT_FAILURE_AFTER_INVOICE");
  }

  await Quote.updateOne(
    { _id: quote._id },
    {
      $set: {
        reservationIds,
        reservationId: reservationIds[0],
      },
    },
    { session },
  ).exec();

  const Cardex = await getCardexModel();
  await Cardex.updateOne(
    { _id: cardexId },
    { $set: { lastReservationAt: now } },
    { session },
  ).exec();

  return {
    quoteId: quote._id,
    reference: quote.reference,
    reservationIds,
    invoiceId: invoice._id,
    invoiceReference,
    cardexId,
    clientAccountId,
    acceptedBy,
    bootstrapped,
    ...(activation ? { activation } : {}),
  };
}

function extractSpaceLines(lines: QuoteLine[]): QuoteLine[] {
  return lines.filter(
    (line) =>
      line.kind === "space" && line.spaceId && line.buildingId && line.startAt && line.endAt,
  );
}

async function loadSpaceContexts(
  spaceLines: QuoteLine[],
  session: ClientSession,
): Promise<SpaceLineContext[]> {
  const Space = await getSpaceModel();
  const contexts: SpaceLineContext[] = [];

  for (const line of spaceLines) {
    const spaceId = line.spaceId!;
    const buildingId = line.buildingId!;
    const startAt = line.startAt!;
    const endAt = line.endAt!;

    const space = await Space.findById(spaceId)
      .session(session)
      .select({ name: 1, type: 1, buildingId: 1 })
      .lean()
      .exec();

    if (!space) {
      throw new AcceptQuoteError(
        "SPACE_NOT_FOUND",
        `Espace introuvable pour la ligne « ${line.label} ».`,
      );
    }

    const reservationType = space.type === "private_office" ? "private_office" : "meeting_room";

    contexts.push({
      line,
      spaceId,
      buildingId,
      startAt,
      endAt,
      spaceSnapshot: { name: space.name, type: space.type },
      reservationType,
    });
  }

  return contexts;
}

async function resolveParties(
  quote: Quote & { _id: Types.ObjectId },
  actor: AcceptQuoteActor,
  now: Date,
  session: ClientSession,
): Promise<{
  cardexId: Types.ObjectId;
  clientAccountId: Types.ObjectId;
  bootstrapped: boolean;
  activation?: AcceptQuoteResult["activation"];
  acceptedBy: QuoteAcceptedBy;
}> {
  if (actor.kind === "staff") {
    return resolveStaffParties(quote, actor, now, session);
  }

  if (actor.kind === "client_register") {
    return resolveClientRegisterParties(quote, actor, now, session);
  }

  return resolveExistingClientParties(quote, actor.clientAccountId, now, session);
}

async function resolveStaffParties(
  quote: Quote & { _id: Types.ObjectId },
  actor: Extract<AcceptQuoteActor, { kind: "staff" }>,
  now: Date,
  session: ClientSession,
): Promise<{
  cardexId: Types.ObjectId;
  clientAccountId: Types.ObjectId;
  bootstrapped: boolean;
  activation?: AcceptQuoteResult["activation"];
  acceptedBy: QuoteAcceptedBy;
}> {
  const acceptedBy: QuoteAcceptedBy = {
    kind: "staff",
    staffProfileId: actor.staffProfileId,
  };

  if (quote.cardexId && quote.clientAccountId) {
    return {
      cardexId: quote.cardexId,
      clientAccountId: quote.clientAccountId,
      bootstrapped: false,
      acceptedBy,
    };
  }

  // Link by prospect email if an account already exists.
  const email = quote.prospect?.email ? normalizeClientEmail(quote.prospect.email) : null;
  if (email) {
    const ClientAccount = await getClientAccountModel();
    const existing = await ClientAccount.findOne({ email })
      .session(session)
      .select({ _id: 1, cardexId: 1, status: 1 })
      .lean()
      .exec();

    if (existing?.cardexId) {
      return {
        cardexId: existing.cardexId,
        clientAccountId: existing._id,
        bootstrapped: false,
        acceptedBy,
      };
    }
  }

  if (!quote.prospect) {
    throw new AcceptQuoteError(
      "PROSPECT_REQUIRED",
      "Le devis doit porter un prospect pour le bootstrap staff-accept.",
    );
  }

  try {
    const boot = await bootstrapQuoteClientFromProspect({
      prospect: quote.prospect,
      tokenSecret: actor.activationTokenSecret,
      now,
      session,
      quoteId: quote._id,
      issuedByStaffProfileId: actor.staffProfileId,
    });
    return {
      cardexId: boot.cardexId,
      clientAccountId: boot.clientAccountId,
      bootstrapped: true,
      activation: {
        rawToken: boot.activationRawToken,
        expiresAt: boot.activationExpiresAt,
        activationId: boot.activationId,
      },
      acceptedBy,
    };
  } catch (error) {
    if (error instanceof QuoteBootstrapError) {
      throw new AcceptQuoteError(
        error.code === "ACCOUNT_ALREADY_EXISTS"
          ? "ACCOUNT_ALREADY_EXISTS"
          : error.code === "PROSPECT_IDENTITY_INCOMPLETE"
            ? "PROSPECT_IDENTITY_INCOMPLETE"
            : "PROSPECT_REQUIRED",
        error.message,
      );
    }
    throw error;
  }
}

async function resolveClientRegisterParties(
  quote: Quote & { _id: Types.ObjectId },
  actor: Extract<AcceptQuoteActor, { kind: "client_register" }>,
  now: Date,
  session: ClientSession,
): Promise<{
  cardexId: Types.ObjectId;
  clientAccountId: Types.ObjectId;
  bootstrapped: boolean;
  acceptedBy: QuoteAcceptedBy;
}> {
  const email = quote.prospect?.email;
  if (!email) {
    throw new AcceptQuoteError(
      "PROSPECT_REQUIRED",
      "Le devis doit porter un email prospect pour créer le compte.",
    );
  }

  let registered;
  try {
    registered = await registerClientAccountForQuoteAccept({
      email,
      password: actor.password,
      privacyPolicyVersion: actor.privacyPolicyVersion,
      marketingCommunicationsAccepted: actor.marketingCommunicationsAccepted,
      now,
      session,
      prospect: quote.prospect,
    });
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      throw new AcceptQuoteError(
        "ACCOUNT_ALREADY_EXISTS",
        "Un compte existe déjà pour cet email. Connectez-vous puis acceptez le devis.",
      );
    }
    throw error;
  }

  const cardexId = await ensureCardexFromProspect(
    registered.clientAccountId,
    quote.prospect,
    now,
    session,
  );

  return {
    cardexId,
    clientAccountId: registered.clientAccountId,
    bootstrapped: false,
    acceptedBy: {
      kind: "client",
      clientAccountId: registered.clientAccountId,
    },
  };
}

async function resolveExistingClientParties(
  quote: Quote & { _id: Types.ObjectId },
  clientAccountId: Types.ObjectId,
  now: Date,
  session: ClientSession,
): Promise<{
  cardexId: Types.ObjectId;
  clientAccountId: Types.ObjectId;
  bootstrapped: boolean;
  acceptedBy: QuoteAcceptedBy;
}> {
  const ClientAccount = await getClientAccountModel();
  const account = await ClientAccount.findById(clientAccountId)
    .session(session)
    .select({ _id: 1, cardexId: 1, status: 1, email: 1 })
    .lean()
    .exec();

  if (!account || account.status !== "active") {
    throw new AcceptQuoteError(
      "ACCOUNT_INVALID",
      "Compte client invalide ou non actif pour accepter ce devis.",
    );
  }

  // Soft email match when prospect is present (defence in depth).
  const prospectEmail = quote.prospect?.email ? normalizeClientEmail(quote.prospect.email) : null;
  if (prospectEmail && account.email !== prospectEmail) {
    throw new AcceptQuoteError(
      "ACCOUNT_INVALID",
      "Le compte connecté ne correspond pas à l'email du devis.",
    );
  }

  let cardexId = account.cardexId ?? quote.cardexId;
  if (!cardexId) {
    cardexId = await ensureCardexFromProspect(account._id, quote.prospect, now, session);
  }

  return {
    cardexId,
    clientAccountId: account._id,
    bootstrapped: false,
    acceptedBy: {
      kind: "client",
      clientAccountId: account._id,
    },
  };
}

async function ensureCardexFromProspect(
  clientAccountId: Types.ObjectId,
  prospect: QuoteProspect | undefined,
  now: Date,
  session: ClientSession,
): Promise<Types.ObjectId> {
  if (!prospect) {
    throw new AcceptQuoteError(
      "PROSPECT_REQUIRED",
      "Le devis doit porter un prospect pour créer le cardex.",
    );
  }

  const identity = resolveProspectIdentity(prospect);
  if (!identity) {
    throw new AcceptQuoteError(
      "PROSPECT_IDENTITY_INCOMPLETE",
      "Le prospect doit inclure prénom et nom (ou displayName) pour créer le cardex.",
    );
  }

  const isCompany = prospect.clientKind === "company" || Boolean(prospect.companyName?.trim());
  const siretDigits = prospect.siret?.replaceAll(/\D/g, "") || undefined;

  const Cardex = await getCardexModel();
  const ClientAccount = await getClientAccountModel();
  const [cardex] = await Cardex.create(
    [
      {
        clientAccountId,
        identity,
        ...(!isCompany && prospect.billingAddress ? { address: prospect.billingAddress } : {}),
        ...(isCompany && prospect.companyName
          ? {
              company: {
                legalName: prospect.companyName,
                ...(siretDigits ? { siret: siretDigits } : {}),
                ...(prospect.vatNumber?.trim() ? { vatNumber: prospect.vatNumber.trim() } : {}),
                ...(prospect.billingAddress ? { billingAddress: prospect.billingAddress } : {}),
              },
            }
          : {}),
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
    throw new Error("Cardex creation failed within accept quote transaction");
  }

  await ClientAccount.updateOne(
    { _id: clientAccountId },
    { $set: { cardexId: cardex._id } },
    { session },
  ).exec();

  return cardex._id;
}

function mapAwaitingPaymentMethod(
  preferred: Quote["paymentMethodPreferred"],
): "card" | "bank_transfer" {
  if (preferred === "card") return "card";
  // bank_transfer + direct_debit stub → bank_transfer hold (no SEPA yet)
  return "bank_transfer";
}

/** Re-export overlap error name for callers that catch reservation conflicts. */
export { ReservationOverlapError };
