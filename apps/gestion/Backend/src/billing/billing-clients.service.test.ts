import { beforeEach, describe, expect, it, vi } from "vitest";

type LeanRow = Record<string, unknown>;

const { accountQueues, cardexQueues, maskEmail } = vi.hoisted(() => ({
  accountQueues: [] as LeanRow[][],
  cardexQueues: [] as LeanRow[][],
  maskEmail: vi.fn((email: string) => {
    const at = email.indexOf("@");
    return `${email.slice(0, Math.min(2, at))}***@${email.slice(at + 1)}`;
  }),
}));

function chainFind(queue: LeanRow[][]) {
  return {
    select: () => ({
      limit: () => ({
        lean: () => ({
          exec: async () => queue.shift() ?? [],
        }),
      }),
      lean: () => ({
        exec: async () => queue.shift() ?? [],
      }),
    }),
  };
}

vi.mock("@coworkprysme/db", () => ({
  connectMongo: vi.fn().mockResolvedValue(undefined),
  getClientAccountModel: vi.fn(async () => ({
    find: () => chainFind(accountQueues),
  })),
  getCardexModel: vi.fn(async () => ({
    find: () => chainFind(cardexQueues),
  })),
  maskClientInviteEmail: (email: string) => maskEmail(email),
}));

import { BillingClientsService } from "./billing-clients.service.js";

describe("BillingClientsService.searchClients", () => {
  let service: BillingClientsService;

  beforeEach(() => {
    accountQueues.length = 0;
    cardexQueues.length = 0;
    maskEmail.mockClear();
    service = new BillingClientsService();
  });

  it("returns masked-email labels for email matches", async () => {
    const cardexId = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const accountId = "bbbbbbbbbbbbbbbbbbbbbbbb";
    accountQueues.push([{ _id: accountId, email: "alice@example.com", cardexId }]);
    cardexQueues.push([]); // name search
    cardexQueues.push([
      {
        _id: cardexId,
        clientAccountId: accountId,
        identity: { firstName: "Alice", lastName: "Martin" },
      },
    ]);

    const result = await service.searchClients("alice");
    expect(result.clients).toEqual([
      {
        cardexId,
        clientAccountId: accountId,
        label: "Alice Martin · al***@example.com",
      },
    ]);
    expect(maskEmail).toHaveBeenCalledWith("alice@example.com");
  });

  it("returns company name matches with masked owner email", async () => {
    const cardexId = "cccccccccccccccccccccccc";
    const accountId = "dddddddddddddddddddddddd";
    accountQueues.push([]); // email search
    cardexQueues.push([
      {
        _id: cardexId,
        clientAccountId: accountId,
        company: { legalName: "MA CONCIERGERIE" },
        identity: { firstName: "Pat", lastName: "Thomas" },
      },
    ]);
    accountQueues.push([{ _id: accountId, email: "pthomas@prysme.eu" }]);

    const result = await service.searchClients("conciergerie");
    expect(result.clients).toEqual([
      {
        cardexId,
        clientAccountId: accountId,
        label: "MA CONCIERGERIE · pt***@prysme.eu",
      },
    ]);
  });
});
