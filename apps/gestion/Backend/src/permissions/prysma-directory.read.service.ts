import { Injectable } from "@nestjs/common";
import { connectMongo } from "@coworkprysme/db";
import { initGestionApiEnv } from "@coworkprysme/shared/server";
import type {
  PermissionsUserRow,
  PrysmaCompanyOption,
  PrysmaSecteurOption,
} from "@coworkprysme/shared";

const USER_LIST_PROJECTION = {
  id: 1,
  photo: 1,
  display_name: 1,
  company_id: 1,
  position: 1,
  is_active: 1,
  is_archived: 1,
} as const;

interface PrysmaUserListDoc {
  id?: string;
  photo?: string;
  display_name?: string;
  company_id?: string;
  position?: string;
  is_active?: boolean;
  is_archived?: boolean;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isPrysmaUserActive(doc: { is_active?: boolean; is_archived?: boolean }): boolean {
  return doc.is_archived !== true && doc.is_active !== false;
}

/** Read-only access to prysma_bdd directory collections (users, companies, secteurs). */
@Injectable()
export class PrysmaDirectoryReadService {
  private async getPrysmaDb() {
    const env = initGestionApiEnv();
    const mongoose = await connectMongo();
    return mongoose.connection.getClient().db(env.MONGODB_DB_PRYSMA);
  }

  async listCompanies(): Promise<PrysmaCompanyOption[]> {
    const prysmaDb = await this.getPrysmaDb();
    const docs = await prysmaDb
      .collection("companies")
      .find(
        { is_archived: { $ne: true } },
        { projection: { id: 1, name: 1, _id: 0 }, sort: { name: 1 } },
      )
      .toArray();

    return docs
      .filter((doc) => Boolean(doc.id && doc.name))
      .map((doc) => ({ id: String(doc.id), name: String(doc.name) }));
  }

  async listSecteurs(companyId: string): Promise<PrysmaSecteurOption[]> {
    const prysmaDb = await this.getPrysmaDb();
    const docs = await prysmaDb
      .collection("secteurs")
      .find(
        { company_id: companyId },
        { projection: { id: 1, name: 1, company_id: 1, _id: 0 }, sort: { name: 1 } },
      )
      .toArray();

    return docs
      .filter((doc) => Boolean(doc.id && doc.name && doc.company_id))
      .map((doc) => ({
        id: String(doc.id),
        name: String(doc.name),
        companyId: String(doc.company_id),
      }));
  }

  async listUsers(filters: {
    companyId?: string;
    secteurId?: string;
    search?: string;
    page: number;
    pageSize: number;
  }): Promise<{ users: PermissionsUserRow[]; total: number }> {
    const prysmaDb = await this.getPrysmaDb();
    const query = this.buildUserFilter(filters);
    const skip = (filters.page - 1) * filters.pageSize;

    const [docs, total] = await Promise.all([
      prysmaDb
        .collection("users")
        .find(query, {
          projection: USER_LIST_PROJECTION,
          sort: { display_name: 1 },
          skip,
          limit: filters.pageSize,
        })
        .toArray() as Promise<PrysmaUserListDoc[]>,
      prysmaDb.collection("users").countDocuments(query),
    ]);

    const activeUsers = docs.filter((doc) => doc.id && isPrysmaUserActive(doc));
    if (activeUsers.length === 0) {
      return { users: [], total };
    }

    const companyIds = [
      ...new Set(activeUsers.map((user) => user.company_id).filter(Boolean)),
    ] as string[];
    const companyNameById = await this.loadCompanyNames(companyIds);

    return {
      total,
      users: activeUsers.map((user) => ({
        id: user.id!,
        photo: optionalString(user.photo),
        displayName: user.display_name?.trim() || user.id!,
        companyId: optionalString(user.company_id),
        companyName: user.company_id ? companyNameById.get(user.company_id) : undefined,
        position: optionalString(user.position),
        role: "none" as const,
      })),
    };
  }

  private buildUserFilter(filters: {
    companyId?: string;
    secteurId?: string;
    search?: string;
  }): Record<string, unknown> {
    const clauses: Record<string, unknown>[] = [{ is_archived: { $ne: true } }];

    if (filters.companyId) {
      clauses.push({ company_id: filters.companyId });
    }

    if (filters.secteurId) {
      clauses.push({
        $or: [{ secteur_actif: filters.secteurId }, { secteurs_autorises: filters.secteurId }],
      });
    }

    const search = filters.search?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      clauses.push({
        $or: [
          { display_name: regex },
          { username: regex },
          { first_name: regex },
          { last_name: regex },
          { email_principal: regex },
        ],
      });
    }

    return clauses.length === 1 ? clauses[0]! : { $and: clauses };
  }

  private async loadCompanyNames(companyIds: string[]): Promise<Map<string, string>> {
    if (companyIds.length === 0) {
      return new Map();
    }

    const prysmaDb = await this.getPrysmaDb();
    const docs = await prysmaDb
      .collection("companies")
      .find({ id: { $in: companyIds } }, { projection: { id: 1, name: 1, _id: 0 } })
      .toArray();

    return new Map(
      docs
        .filter((doc) => Boolean(doc.id && doc.name))
        .map((doc) => [String(doc.id), String(doc.name)]),
    );
  }
}
