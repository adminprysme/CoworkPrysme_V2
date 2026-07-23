import { Injectable } from "@nestjs/common";
import {
  connectMongo,
  getCardexModel,
  getClientAccountModel,
  maskClientInviteEmail,
} from "@coworkprysme/db";
import type {
  StaffBillingClientSearchItem,
  StaffBillingClientSearchResponse,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

const SEARCH_LIMIT = 20;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cardexDisplayName(row: {
  identity?: { firstName?: string; lastName?: string };
  company?: { legalName?: string };
}): string {
  const company = row.company?.legalName?.trim();
  if (company) return company;
  const name = [row.identity?.firstName, row.identity?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || "Client";
}

@Injectable()
export class BillingClientsService {
  /**
   * Cross-cardex search by ClientAccount email OR Cardex identity / company.legalName.
   * Labels use invitation-style masked emails (no raw ObjectIds in the UI payload label).
   */
  async searchClients(q: string): Promise<StaffBillingClientSearchResponse> {
    await connectMongo();
    const trimmed = q.trim();
    const rx = { $regex: escapeRegex(trimmed), $options: "i" };

    const ClientAccount = await getClientAccountModel();
    const Cardex = await getCardexModel();

    const [accountsByEmail, cardexesByName] = await Promise.all([
      ClientAccount.find({ email: rx })
        .select({ _id: 1, email: 1, cardexId: 1 })
        .limit(SEARCH_LIMIT)
        .lean()
        .exec(),
      Cardex.find({
        $or: [
          { "identity.firstName": rx },
          { "identity.lastName": rx },
          { "company.legalName": rx },
        ],
      })
        .select({ _id: 1, clientAccountId: 1, identity: 1, company: 1 })
        .limit(SEARCH_LIMIT)
        .lean()
        .exec(),
    ]);

    const byCardexId = new Map<string, StaffBillingClientSearchItem>();

    const accountCardexIds = accountsByEmail
      .map((row) => row.cardexId)
      .filter((id): id is Types.ObjectId => Boolean(id));

    const cardexesForAccounts =
      accountCardexIds.length > 0
        ? await Cardex.find({ _id: { $in: accountCardexIds } })
            .select({ _id: 1, clientAccountId: 1, identity: 1, company: 1 })
            .lean()
            .exec()
        : [];
    const cardexById = new Map(cardexesForAccounts.map((row) => [String(row._id), row]));

    for (const account of accountsByEmail) {
      if (!account.cardexId) continue;
      const cardexId = String(account.cardexId);
      const cardex = cardexById.get(cardexId);
      const name = cardex ? cardexDisplayName(cardex) : "Client";
      byCardexId.set(cardexId, {
        cardexId,
        clientAccountId: String(account._id),
        label: `${name} · ${maskClientInviteEmail(account.email)}`,
      });
    }

    const uncoveredCardexes = cardexesByName.filter((row) => !byCardexId.has(String(row._id)));
    const uncoveredAccountIds = uncoveredCardexes.map((row) => row.clientAccountId);
    const accountsForNameHits =
      uncoveredAccountIds.length > 0
        ? await ClientAccount.find({ _id: { $in: uncoveredAccountIds } })
            .select({ _id: 1, email: 1 })
            .lean()
            .exec()
        : [];
    const emailByAccountId = new Map(
      accountsForNameHits.map((row) => [String(row._id), row.email as string]),
    );

    for (const cardex of uncoveredCardexes) {
      const cardexId = String(cardex._id);
      const clientAccountId = String(cardex.clientAccountId);
      const email = emailByAccountId.get(clientAccountId);
      byCardexId.set(cardexId, {
        cardexId,
        clientAccountId,
        label: `${cardexDisplayName(cardex)} · ${email ? maskClientInviteEmail(email) : "***"}`,
      });
    }

    return { clients: [...byCardexId.values()].slice(0, SEARCH_LIMIT) };
  }
}
