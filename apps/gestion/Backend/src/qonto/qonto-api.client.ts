import { Injectable, Logger } from "@nestjs/common";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI */
import { QontoAuthService } from "./qonto-auth.service.js";
import { QontoConfigService } from "./qonto-config.service.js";

/** Subset of Qonto transaction fields we persist for matching (no counterparty IBAN). */
export interface QontoTransactionDto {
  transaction_id: string;
  amount_cents: number;
  currency: string;
  side: string;
  operation_type?: string;
  label: string | null;
  reference: string | null;
  settled_at: string | null;
  status?: string;
}

interface OrganizationResponse {
  organization?: {
    bank_accounts?: Array<{
      id: string;
      slug?: string;
      iban?: string;
      balance?: number;
      status?: string;
    }>;
  };
}

interface TransactionsListResponse {
  transactions?: QontoTransactionDto[];
  meta?: { next_page?: number | null; current_page?: number; total_pages?: number };
}

/**
 * Read-only Qonto Business API client.
 * Only GET is allowed against the API base — never initiate transfers or mutate accounts.
 */
@Injectable()
export class QontoApiClient {
  private readonly logger = new Logger(QontoApiClient.name);

  constructor(
    private readonly auth: QontoAuthService,
    private readonly qontoConfig: QontoConfigService,
  ) {}

  async getOrganizationBankAccountId(): Promise<string> {
    const configured = this.qontoConfig.config.bankAccountId;
    if (configured) {
      return configured;
    }
    const cached = await this.auth.getCachedBankAccountId();
    if (cached) {
      return cached;
    }

    const data = await this.getJson<OrganizationResponse>("/v2/organization");
    const accounts = data.organization?.bank_accounts ?? [];
    const active = accounts.find((a) => a.status === "active") ?? accounts[0];
    if (!active?.id) {
      throw new Error("No Qonto bank account found on organization");
    }
    await this.auth.setCachedBankAccountId(active.id);
    return active.id;
  }

  async listCreditTransactions(input: {
    settledAtFrom: Date;
    settledAtTo?: Date;
  }): Promise<QontoTransactionDto[]> {
    const bankAccountId = await this.getOrganizationBankAccountId();
    const collected: QontoTransactionDto[] = [];
    let page = 1;
    const maxPages = 20;

    while (page <= maxPages) {
      const params = new URLSearchParams({
        bank_account_id: bankAccountId,
        side: "credit",
        settled_at_from: input.settledAtFrom.toISOString(),
        per_page: "100",
        page: String(page),
        sort_by: "settled_at:desc",
      });
      if (input.settledAtTo) {
        params.set("settled_at_to", input.settledAtTo.toISOString());
      }

      const data = await this.getJson<TransactionsListResponse>(`/v2/transactions?${params}`);
      const batch = data.transactions ?? [];
      collected.push(...batch);

      const next = data.meta?.next_page;
      if (!next || batch.length === 0) {
        break;
      }
      page = next;
    }

    return collected;
  }

  private async getJson<T>(pathAndQuery: string): Promise<T> {
    if (!pathAndQuery.startsWith("/")) {
      throw new Error("Qonto API path must be absolute from root");
    }

    const accessToken = await this.auth.getAccessToken();
    const { endpoints, env, stagingToken } = this.qontoConfig.config;
    const url = `${endpoints.apiBaseUrl}${pathAndQuery}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };
    if (env === "sandbox" && stagingToken) {
      headers["X-Qonto-Staging-Token"] = stagingToken;
    }

    // Hard guard: this client never issues write methods against the Business API.
    const method = "GET" as const;
    const response = await fetch(url, { method, headers });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      this.logger.error(`Qonto GET ${pathAndQuery.split("?")[0]} failed status=${response.status}`);
      throw new Error(
        `Qonto API error (${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }

    return (await response.json()) as T;
  }
}
