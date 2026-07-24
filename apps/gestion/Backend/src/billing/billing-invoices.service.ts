import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  connectMongo,
  getCardexModel,
  getClientAccountModel,
  getInvoiceModel,
  getPaymentModel,
  getReservationModel,
  type Invoice,
} from "@coworkprysme/db";
/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { InvoicePdfService } from "@coworkprysme/invoice-pdf";
import {
  StaffBillingInvoiceListItemSchema,
  StaffBillingInvoiceListResponseSchema,
  type StaffBillingInvoiceListItem,
  type StaffBillingInvoiceListQuery,
  type StaffBillingInvoiceListResponse,
  type StaffPaymentMethod,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toIso(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

/** Map reservation awaitingPaymentMethod → Payment.method vocabulary. */
function mapAwaitingToPaymentMethod(
  awaiting: "card" | "bank_transfer" | undefined | null,
): StaffPaymentMethod | null {
  if (awaiting === "card") return "card";
  if (awaiting === "bank_transfer") return "transfer";
  return null;
}

type InvoiceLean = Invoice & { _id: Types.ObjectId };
type InvoiceFilter = Record<string, unknown>;

@Injectable()
export class BillingInvoicesService {
  constructor(private readonly invoicePdf: InvoicePdfService) {}

  async list(query: StaffBillingInvoiceListQuery): Promise<StaffBillingInvoiceListResponse> {
    await connectMongo();
    const Invoice = await getInvoiceModel();

    const filter = await this.buildFilter(query);
    const skip = (query.page - 1) * query.pageSize;

    // Use find/countDocuments (not aggregate $match): mongoose casts string
    // ObjectIds; aggregate does not — paymentMethod / q filters would desync.
    const [rows, matchingTotals] = await Promise.all([
      Invoice.find(filter)
        .sort({ issuedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(query.pageSize)
        .lean()
        .exec(),
      Invoice.find(filter).select({ "totals.balanceDue": 1, "totals.paidTotal": 1 }).lean().exec(),
    ]);

    const summary = {
      invoiceCount: matchingTotals.length,
      balanceDueCents: matchingTotals.reduce((sum, row) => sum + (row.totals?.balanceDue ?? 0), 0),
      paidTotalCents: matchingTotals.reduce((sum, row) => sum + (row.totals?.paidTotal ?? 0), 0),
    };

    const invoices = await this.mapRows(rows as InvoiceLean[]);
    return StaffBillingInvoiceListResponseSchema.parse({
      invoices,
      total: summary.invoiceCount,
      page: query.page,
      pageSize: query.pageSize,
      summary,
    });
  }

  /**
   * Global billing PDF download (no cardex membership check).
   * Distinct from Planning cardex-scoped PDF under ClientsPermissionGuard.
   */
  async preparePdf(
    invoiceId: string,
  ): Promise<{ pdf: Buffer; filename: string; reference: string }> {
    await connectMongo();
    if (!OBJECT_ID_PATTERN.test(invoiceId)) {
      throw new BadRequestException({
        code: "INVALID_ID",
        message: "invoiceId invalide",
      });
    }

    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findById(invoiceId).exec();
    if (!invoice) {
      throw new NotFoundException({
        code: "INVOICE_NOT_FOUND",
        message: "Facture introuvable",
      });
    }

    const { pdf } = await this.invoicePdf.generatePdfForInvoiceReference(invoice.reference);
    const safeRef = invoice.reference.replace(/[^\w.-]+/g, "_");
    const filename = `${invoice.type}-${safeRef}.pdf`;

    return {
      pdf,
      filename,
      reference: invoice.reference,
    };
  }

  private async buildFilter(query: StaffBillingInvoiceListQuery): Promise<InvoiceFilter> {
    const andFilters: InvoiceFilter[] = [];

    if (query.q?.trim()) {
      const cardexIds = await this.findCardexIdsMatchingSearch(query.q.trim());
      const rx = { $regex: escapeRegex(query.q.trim()), $options: "i" };
      andFilters.push({
        $or: [
          { reference: rx },
          ...(cardexIds.length > 0 ? [{ cardexId: { $in: cardexIds } }] : []),
        ],
      });
    }

    if (query.status) {
      andFilters.push({ status: query.status });
    }

    if (query.paymentMethod) {
      const invoiceIds = await this.findInvoiceIdsForPaymentMethod(query.paymentMethod);
      andFilters.push({ _id: { $in: invoiceIds } });
    }

    if (query.issuedFrom || query.issuedTo) {
      const range: Record<string, Date> = {};
      if (query.issuedFrom) range.$gte = new Date(query.issuedFrom);
      if (query.issuedTo) range.$lte = new Date(query.issuedTo);
      andFilters.push({ issuedAt: range });
    }

    if (andFilters.length === 0) return {};
    if (andFilters.length === 1) return andFilters[0]!;
    return { $and: andFilters };
  }

  private async findCardexIdsMatchingSearch(q: string): Promise<string[]> {
    const rx = { $regex: escapeRegex(q), $options: "i" };
    const Cardex = await getCardexModel();
    const ClientAccount = await getClientAccountModel();

    const [cardexRows, accountRows] = await Promise.all([
      Cardex.find({
        $or: [
          { "identity.firstName": rx },
          { "identity.lastName": rx },
          { "company.legalName": rx },
        ],
      })
        .select({ _id: 1 })
        .lean()
        .exec(),
      ClientAccount.find({ email: rx }).select({ cardexId: 1 }).lean().exec(),
    ]);

    const ids = new Set<string>();
    for (const row of cardexRows) {
      ids.add(String(row._id));
    }
    for (const row of accountRows) {
      if (row.cardexId) ids.add(String(row.cardexId));
    }
    return [...ids];
  }

  private async findInvoiceIdsForPaymentMethod(method: StaffPaymentMethod): Promise<string[]> {
    const Payment = await getPaymentModel();
    const Reservation = await getReservationModel();
    const Invoice = await getInvoiceModel();

    const paidRows = await Payment.find({ method, kind: { $ne: "refund" } })
      .select({ invoiceId: 1 })
      .lean()
      .exec();
    const ids = new Set(paidRows.map((row) => String(row.invoiceId)));

    // Unpaid / awaiting: map filter vocabulary back to reservation awaiting method.
    const awaitingMethod =
      method === "transfer" ? "bank_transfer" : method === "card" ? "card" : null;
    if (awaitingMethod) {
      const reservations = await Reservation.find({
        status: "awaiting_payment",
        awaitingPaymentMethod: awaitingMethod,
      })
        .select({ _id: 1 })
        .lean()
        .exec();
      const reservationIds = reservations.map((row) => row._id);
      if (reservationIds.length > 0) {
        const awaitingInvoices = await Invoice.find({
          $or: [
            { reservationId: { $in: reservationIds } },
            { reservationIds: { $in: reservationIds } },
          ],
          "totals.balanceDue": { $gt: 0 },
        })
          .select({ _id: 1 })
          .lean()
          .exec();
        for (const inv of awaitingInvoices) {
          ids.add(String(inv._id));
        }
      }
    }

    return [...ids];
  }

  private async mapRows(rows: InvoiceLean[]): Promise<StaffBillingInvoiceListItem[]> {
    if (rows.length === 0) return [];

    const invoiceIds = rows.map((row) => row._id);
    const cardexIds = [...new Set(rows.map((row) => String(row.cardexId)))];
    const reservationIdSet = new Set<string>();
    for (const row of rows) {
      if (row.reservationId) reservationIdSet.add(String(row.reservationId));
      for (const id of row.reservationIds ?? []) {
        reservationIdSet.add(String(id));
      }
    }

    const [Cardex, ClientAccount, Payment, Reservation] = await Promise.all([
      getCardexModel(),
      getClientAccountModel(),
      getPaymentModel(),
      getReservationModel(),
    ]);

    const [cardexes, accounts, payments, reservations] = await Promise.all([
      Cardex.find({ _id: { $in: cardexIds } })
        .select({ identity: 1, company: 1 })
        .lean()
        .exec(),
      ClientAccount.find({ cardexId: { $in: cardexIds } })
        .select({ email: 1, cardexId: 1 })
        .lean()
        .exec(),
      Payment.find({ invoiceId: { $in: invoiceIds }, kind: { $ne: "refund" } })
        .select({ invoiceId: 1, method: 1 })
        .lean()
        .exec(),
      reservationIdSet.size > 0
        ? Reservation.find({ _id: { $in: [...reservationIdSet] } })
            .select({ awaitingPaymentMethod: 1, status: 1 })
            .lean()
            .exec()
        : Promise.resolve([]),
    ]);

    const cardexById = new Map(cardexes.map((row) => [String(row._id), row]));
    const emailsByCardex = new Map<string, string[]>();
    for (const account of accounts) {
      if (!account.cardexId) continue;
      const key = String(account.cardexId);
      const list = emailsByCardex.get(key) ?? [];
      list.push(account.email);
      emailsByCardex.set(key, list);
    }
    const methodsByInvoice = new Map<string, Set<StaffPaymentMethod>>();
    for (const payment of payments) {
      const key = String(payment.invoiceId);
      const set = methodsByInvoice.get(key) ?? new Set();
      set.add(payment.method as StaffPaymentMethod);
      methodsByInvoice.set(key, set);
    }
    const reservationById = new Map(reservations.map((row) => [String(row._id), row]));

    return rows.map((row) => {
      const cardexKey = String(row.cardexId);
      const cardex = cardexById.get(cardexKey);
      const first = cardex?.identity?.firstName?.trim() ?? "";
      const last = cardex?.identity?.lastName?.trim() ?? "";
      const clientLabel = [first, last].filter(Boolean).join(" ") || "—";
      const companyLegalName = cardex?.company?.legalName?.trim() || null;
      const emails = [...new Set(emailsByCardex.get(cardexKey) ?? [])].sort();

      const methods = new Set<StaffPaymentMethod>(methodsByInvoice.get(String(row._id)) ?? []);
      if (methods.size === 0) {
        const resIds = [
          ...(row.reservationId ? [String(row.reservationId)] : []),
          ...(row.reservationIds ?? []).map(String),
        ];
        for (const rid of resIds) {
          const resa = reservationById.get(rid);
          const mapped = mapAwaitingToPaymentMethod(
            resa?.awaitingPaymentMethod as "card" | "bank_transfer" | undefined,
          );
          if (mapped) methods.add(mapped);
        }
      }

      const paymentMethods = [...methods];
      return StaffBillingInvoiceListItemSchema.parse({
        id: String(row._id),
        reference: row.reference,
        type: row.type,
        status: row.status,
        totals: {
          ht: row.totals.ht,
          vat: row.totals.vat,
          ttc: row.totals.ttc,
          discountTotal: row.totals.discountTotal,
          paidTotal: row.totals.paidTotal,
          balanceDue: row.totals.balanceDue,
        },
        cardexId: cardexKey,
        clientLabel,
        companyLegalName,
        companyName: companyLegalName,
        emails,
        paymentMethods,
        paymentMethod: paymentMethods[0] ?? null,
        ...(row.issuedAt ? { issuedAt: toIso(row.issuedAt) } : {}),
        createdAt: toIso(row.createdAt)!,
      });
    });
  }
}
