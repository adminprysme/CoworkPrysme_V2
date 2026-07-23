import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  connectMongoMock,
  assertReplicaSetForTransactionsMock,
  getQuoteModelMock,
  getAuditLogModelMock,
  getCardexModelMock,
  getClientAccountModelMock,
  nextReferenceMock,
  attachQuoteAcceptTokenMock,
  parseGestionApiEnvMock,
} = vi.hoisted(() => ({
  connectMongoMock: vi.fn(),
  assertReplicaSetForTransactionsMock: vi.fn(),
  getQuoteModelMock: vi.fn(),
  getAuditLogModelMock: vi.fn(),
  getCardexModelMock: vi.fn(),
  getClientAccountModelMock: vi.fn(),
  nextReferenceMock: vi.fn(),
  attachQuoteAcceptTokenMock: vi.fn(),
  parseGestionApiEnvMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  connectMongo: connectMongoMock,
  assertReplicaSetForTransactions: assertReplicaSetForTransactionsMock,
  getQuoteModel: getQuoteModelMock,
  getAuditLogModel: getAuditLogModelMock,
  getCardexModel: getCardexModelMock,
  getClientAccountModel: getClientAccountModelMock,
  nextReference: nextReferenceMock,
  attachQuoteAcceptToken: attachQuoteAcceptTokenMock,
}));

vi.mock("@coworkprysme/shared/server", () => ({
  parseGestionApiEnv: parseGestionApiEnvMock,
}));

import { QuotesService } from "./quotes.service.js";
import type { MailService } from "../mail/mail.service.js";

const STAFF_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const QUOTE_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

function staffProfile() {
  return { _id: STAFF_ID, permissions: { billing: true } } as never;
}

function baseQuoteDoc(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-07-23T12:00:00.000Z");
  const doc = {
    _id: QUOTE_ID,
    reference: "DEV-2026-00001",
    currency: "EUR",
    status: "draft",
    lines: [
      {
        lineId: "line-1",
        kind: "space",
        label: "FOCUS",
        calculatedUnitPriceHT: 10000,
        calculatedTotalHT: 10000,
        calculatedTotalVAT: 2000,
        calculatedTotalTTC: 12000,
        unitPriceHT: 10000,
        qty: 1,
        vatRate: 20,
        discount: 0,
        totalHT: 10000,
        totalVAT: 2000,
        totalTTC: 12000,
        priceSource: "auto",
      },
    ],
    vatBreakdown: [{ rate: 20, baseHT: 10000, vat: 2000 }],
    totals: { ht: 10000, vat: 2000, ttc: 12000, discountTotal: 0 },
    depositPercent: 0,
    depositAmountHT: 0,
    depositAmountTTC: 0,
    depositVatBreakdown: [],
    reservationIds: [],
    prospect: {
      email: "prospect@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
    },
    validUntil: new Date("2026-08-15T00:00:00.000Z"),
    createdByStaffProfileId: STAFF_ID,
    createdAt: now,
    updatedAt: now,
    save: vi.fn().mockResolvedValue(undefined),
    deleteOne: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return doc;
}

describe("QuotesService", () => {
  let service: QuotesService;
  let mail: MailService;
  let auditCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    connectMongoMock.mockResolvedValue({
      connection: {},
      startSession: async () => ({
        withTransaction: async (fn: () => Promise<void>) => fn(),
        endSession: async () => undefined,
      }),
    });
    assertReplicaSetForTransactionsMock.mockResolvedValue(undefined);
    nextReferenceMock.mockResolvedValue("DEV-2026-00042");
    parseGestionApiEnvMock.mockReturnValue({
      QUOTE_ACCEPT_TOKEN_SECRET: "q".repeat(32),
    });
    attachQuoteAcceptTokenMock.mockResolvedValue({
      rawToken: "a".repeat(64),
      tokenHash: "b".repeat(64),
      expiresAt: new Date("2026-08-15T00:00:00.000Z"),
    });
    auditCreate = vi.fn().mockResolvedValue({ _id: "audit1" });
    getAuditLogModelMock.mockResolvedValue({ create: auditCreate });
    getCardexModelMock.mockResolvedValue({
      findById: () => ({ select: () => ({ lean: () => ({ exec: async () => null }) }) }),
    });
    getClientAccountModelMock.mockResolvedValue({
      findById: () => ({ select: () => ({ lean: () => ({ exec: async () => null }) }) }),
    });

    mail = {
      sendMail: vi.fn().mockResolvedValue({ dryRun: true }),
    } as unknown as MailService;
    service = new QuotesService(mail);
  });

  describe("create", () => {
    it("creates a draft and recomputes pricing", async () => {
      const createdDoc = baseQuoteDoc({
        reference: "DEV-2026-00042",
        depositPercent: 30,
        depositAmountTTC: 3600,
        depositAmountHT: 3000,
      });
      getQuoteModelMock.mockResolvedValue({
        create: async (docs: unknown[]) => {
          Object.assign(createdDoc, (docs as Record<string, unknown>[])[0], {
            _id: QUOTE_ID,
            createdAt: createdDoc.createdAt,
            updatedAt: createdDoc.updatedAt,
            save: createdDoc.save,
            deleteOne: createdDoc.deleteOne,
          });
          return [createdDoc];
        },
      });

      const result = await service.create(staffProfile(), {
        prospect: { email: "prospect@example.com", displayName: "Ada" },
        lines: [
          {
            lineId: "line-1",
            kind: "space",
            label: "FOCUS",
            calculatedUnitPriceHT: 10000,
            qty: 1,
            vatRate: 20,
          },
        ],
        depositPercent: 30,
        validUntil: "2026-08-15T00:00:00.000Z",
      });

      expect(result.status).toBe("draft");
      expect(result.reference).toBe("DEV-2026-00042");
      expect(result.totals.ttc).toBe(12000);
      expect(result.depositAmountTTC).toBe(3600);
      expect(nextReferenceMock).toHaveBeenCalledWith("DEV", expect.anything());
    });
  });

  describe("forbidden status transitions", () => {
    it("rejects patch on accepted quote", async () => {
      const doc = baseQuoteDoc({ status: "accepted" });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      await expect(
        service.update(staffProfile(), QUOTE_ID, { internalNote: "x" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects delete on non-draft", async () => {
      const doc = baseQuoteDoc({ status: "sent" });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      await expect(service.deleteDraft(staffProfile(), QUOTE_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(doc.deleteOne).not.toHaveBeenCalled();
    });

    it("rejects send when already accepted", async () => {
      const doc = baseQuoteDoc({ status: "accepted" });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      await expect(service.send(staffProfile(), QUOTE_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(attachQuoteAcceptTokenMock).not.toHaveBeenCalled();
    });

    it("rejects refuse when not sent", async () => {
      const doc = baseQuoteDoc({ status: "draft" });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      await expect(service.refuse(staffProfile(), QUOTE_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("rejects expire when not sent", async () => {
      const doc = baseQuoteDoc({ status: "accepted" });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      await expect(service.expire(staffProfile(), QUOTE_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("rejects send without prospect identity when no cardex", async () => {
      const doc = baseQuoteDoc({
        prospect: { email: "only@example.com" },
        cardexId: undefined,
      });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      await expect(service.send(staffProfile(), QUOTE_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("rejects send with empty lines", async () => {
      const doc = baseQuoteDoc({ lines: [] });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      await expect(service.send(staffProfile(), QUOTE_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe("send / refuse / expire / delete draft", () => {
    it("sends draft → sent with accept token and email", async () => {
      const draft = baseQuoteDoc({ status: "draft" });
      const sent = baseQuoteDoc({ status: "draft" });
      let call = 0;
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({
          exec: async () => {
            call += 1;
            return call === 1 ? draft : sent;
          },
        }),
      });

      const result = await service.send(staffProfile(), QUOTE_ID);

      expect(attachQuoteAcceptTokenMock).toHaveBeenCalled();
      expect(sent.status).toBe("sent");
      expect(sent.save).toHaveBeenCalled();
      expect(mail.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "prospect@example.com",
          subject: expect.stringContaining("DEV-2026-00001"),
        }),
      );
      expect(result.emailSent).toBe(true);
      expect(result.quote.status).toBe("sent");
      expect(result.acceptUrl).toContain("/accepter-devis?token=");
    });

    it("refuses sent → refused", async () => {
      const doc = baseQuoteDoc({ status: "sent" });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      const result = await service.refuse(staffProfile(), QUOTE_ID);
      expect(result.status).toBe("refused");
      expect(doc.status).toBe("refused");
      expect(auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ action: "quote.refused" }),
      );
    });

    it("expires sent → expired", async () => {
      const doc = baseQuoteDoc({ status: "sent" });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      const result = await service.expire(staffProfile(), QUOTE_ID);
      expect(result.status).toBe("expired");
      expect(auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ action: "quote.expired" }),
      );
    });

    it("hard-deletes draft with quote.deleted audit", async () => {
      const doc = baseQuoteDoc({ status: "draft" });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      const result = await service.deleteDraft(staffProfile(), QUOTE_ID);
      expect(result).toEqual({ ok: true, id: QUOTE_ID });
      expect(doc.deleteOne).toHaveBeenCalled();
      expect(auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ action: "quote.deleted" }),
      );
    });
  });

  describe("getById / update draft", () => {
    it("404 when missing", async () => {
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => null }),
      });
      await expect(service.getById(QUOTE_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("allows full patch on draft", async () => {
      const doc = baseQuoteDoc({ status: "draft" });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      const result = await service.update(staffProfile(), QUOTE_ID, {
        internalNote: "staff note",
        depositPercent: 50,
      });
      expect(result.internalNote).toBe("staff note");
      expect(doc.depositPercent).toBe(50);
      expect(doc.depositAmountTTC).toBe(6000);
    });

    it("allows internalNote-only patch on sent", async () => {
      const doc = baseQuoteDoc({ status: "sent" });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      const result = await service.update(staffProfile(), QUOTE_ID, {
        internalNote: "follow-up",
      });
      expect(result.internalNote).toBe("follow-up");
    });

    it("rejects non-internalNote patch on sent", async () => {
      const doc = baseQuoteDoc({ status: "sent" });
      getQuoteModelMock.mockResolvedValue({
        findById: () => ({ exec: async () => doc }),
      });

      await expect(
        service.update(staffProfile(), QUOTE_ID, { depositPercent: 10 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
