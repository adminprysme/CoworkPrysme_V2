import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { acceptQuoteMock, getQuoteByAcceptTokenMock, registerClientAccountForQuoteAcceptMock } =
  vi.hoisted(() => {
    const acceptQuoteMock = vi.fn();
    Object.defineProperty(acceptQuoteMock, "name", { value: "acceptQuote" });
    return {
      acceptQuoteMock,
      getQuoteByAcceptTokenMock: vi.fn(),
      registerClientAccountForQuoteAcceptMock: vi.fn(),
    };
  });

vi.mock("@coworkprysme/db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    acceptQuote: acceptQuoteMock,
    getQuoteByAcceptToken: getQuoteByAcceptTokenMock,
    registerClientAccountForQuoteAccept: registerClientAccountForQuoteAcceptMock,
  };
});

vi.mock("@coworkprysme/shared/server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    parseVitrineApiEnv: () => ({
      QUOTE_ACCEPT_TOKEN_SECRET: "q".repeat(32),
    }),
  };
});

import { acceptQuote as domainAcceptQuote } from "@coworkprysme/db";
import { PRIVACY_POLICY_VERSION } from "@coworkprysme/shared";

import { QuotesAcceptService, sharedAcceptQuoteDomain } from "./quotes-accept.service.js";

const QUOTE_ID = new Types.ObjectId("507f1f77bcf86cd799439001");
const CLIENT_ACCOUNT_ID = new Types.ObjectId("507f1f77bcf86cd799439002");
const CARDEX_ID = new Types.ObjectId("507f1f77bcf86cd799439003");
const INVOICE_ID = new Types.ObjectId("507f1f77bcf86cd799439004");
const RESERVATION_ID = new Types.ObjectId("507f1f77bcf86cd799439005");
const TOKEN = "raw-accept-token";

function sentQuoteDoc() {
  return {
    _id: QUOTE_ID,
    reference: "DEV-2026-00042",
    status: "sent",
    validUntil: new Date("2026-08-01T22:00:00.000Z"),
    prospect: {
      email: "prospect@example.com",
      firstName: "Alice",
      lastName: "Martin",
    },
    paymentMethodPreferred: "card",
    totals: { ht: 25000, vat: 5000, ttc: 30000 },
  };
}

function acceptResult(overrides: Record<string, unknown> = {}) {
  return {
    quoteId: QUOTE_ID,
    reference: "DEV-2026-00042",
    reservationIds: [RESERVATION_ID],
    invoiceId: INVOICE_ID,
    invoiceReference: "PF-2026-00042",
    cardexId: CARDEX_ID,
    clientAccountId: CLIENT_ACCOUNT_ID,
    bootstrapped: false,
    acceptedBy: { kind: "client" as const, clientAccountId: CLIENT_ACCOUNT_ID },
    ...overrides,
  };
}

/**
 * Proof point #1: client (vitrine) and staff (gestion) call the exact same
 * domain function — no parallel divergent AcceptQuote implementations.
 *
 * Client dual-path wiring (#8) is below; deep Mongo proofs (validUntil /
 * acceptedBy persistence) live in accept-quote.integration.test.ts.
 */
describe("unified AcceptQuoteService import", () => {
  it("vitrine QuotesAcceptService re-exports the same acceptQuote reference", () => {
    expect(sharedAcceptQuoteDomain).toBe(domainAcceptQuote);
    expect(sharedAcceptQuoteDomain.name).toBe("acceptQuote");
  });
});

/**
 * Proof point — client dual path on the vitrine adapter (user-visible in this file):
 * (a) existing account → confirm with clientAccountId, no account creation
 * (b) no account → confirm with client password → client_register (create then accept)
 */
describe("QuotesAcceptService client dual path", () => {
  let service: QuotesAcceptService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QuotesAcceptService();
    getQuoteByAcceptTokenMock.mockResolvedValue(sentQuoteDoc());
    acceptQuoteMock.mockResolvedValue(acceptResult());
  });

  it("existing account: confirm with clientAccountId accepts direct (no account creation)", async () => {
    const response = await service.confirm(TOKEN, {
      clientAccountId: String(CLIENT_ACCOUNT_ID),
    });

    expect(registerClientAccountForQuoteAcceptMock).not.toHaveBeenCalled();
    expect(acceptQuoteMock).toHaveBeenCalledTimes(1);
    expect(acceptQuoteMock).toHaveBeenCalledWith({
      quoteId: QUOTE_ID,
      actor: {
        kind: "client",
        clientAccountId: CLIENT_ACCOUNT_ID,
      },
    });
    const actor = acceptQuoteMock.mock.calls[0]![0].actor;
    expect(actor.kind).toBe("client");
    expect(actor).not.toHaveProperty("staffProfileId");
    expect(actor).not.toHaveProperty("password");
    expect(response).toMatchObject({
      quoteId: String(QUOTE_ID),
      clientAccountId: String(CLIENT_ACCOUNT_ID),
      status: "accepted",
    });
  });

  it("no account: confirm with client password creates via client_register then accepts", async () => {
    const password = "ChosenPass9!";
    acceptQuoteMock.mockResolvedValue(
      acceptResult({
        acceptedBy: { kind: "client", clientAccountId: CLIENT_ACCOUNT_ID },
      }),
    );

    const response = await service.confirm(TOKEN, {
      password,
      privacyPolicyAccepted: true,
      marketingCommunicationsAccepted: false,
      cgvAccepted: true,
    });

    expect(acceptQuoteMock).toHaveBeenCalledTimes(1);
    expect(acceptQuoteMock).toHaveBeenCalledWith({
      quoteId: QUOTE_ID,
      actor: {
        kind: "client_register",
        password,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        marketingCommunicationsAccepted: false,
      },
    });
    const actor = acceptQuoteMock.mock.calls[0]![0].actor;
    expect(actor.kind).toBe("client_register");
    expect(actor.password).toBe(password);
    expect(actor).not.toHaveProperty("staffProfileId");
    expect(actor).not.toHaveProperty("clientAccountId");
    // Account creation is owned by domain acceptQuote(client_register) — vitrine must not
    // pre-create via registerClientAccountForQuoteAccept on this one-shot confirm path.
    expect(registerClientAccountForQuoteAcceptMock).not.toHaveBeenCalled();
    expect(response.status).toBe("accepted");
  });
});
