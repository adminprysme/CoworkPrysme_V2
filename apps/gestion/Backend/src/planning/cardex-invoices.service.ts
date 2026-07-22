import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { connectMongo, getCardexModel, getInvoiceModel, type Invoice } from "@coworkprysme/db";
import {
  CARDEX_INVOICE_STAFF_ERROR_CODES,
  CARDEX_INVOICE_STAFF_ERROR_MESSAGES,
  StaffCardexInvoiceSchema,
  StaffCardexInvoicesListResponseSchema,
  type StaffCardexInvoice,
  type StaffCardexInvoicesListResponse,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { InvoicePdfService } from "@coworkprysme/invoice-pdf";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function assertObjectId(value: string, label: string): string {
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw new BadRequestException({
      code: CARDEX_INVOICE_STAFF_ERROR_CODES.INVALID_ID,
      message: `${label} invalide`,
    });
  }
  return value;
}

function toIso(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

type InvoiceDoc = Invoice & { _id: Types.ObjectId };

function mapInvoice(doc: InvoiceDoc): StaffCardexInvoice {
  return StaffCardexInvoiceSchema.parse({
    id: String(doc._id),
    reference: doc.reference,
    type: doc.type,
    status: doc.status,
    totals: {
      ht: doc.totals.ht,
      vat: doc.totals.vat,
      ttc: doc.totals.ttc,
      discountTotal: doc.totals.discountTotal,
      paidTotal: doc.totals.paidTotal,
      balanceDue: doc.totals.balanceDue,
    },
    ...(doc.issuedAt ? { issuedAt: toIso(doc.issuedAt) } : {}),
    ...(doc.reservationId ? { reservationId: String(doc.reservationId) } : {}),
  });
}

@Injectable()
export class CardexInvoicesService {
  constructor(private readonly invoicePdf: InvoicePdfService) {}

  async list(cardexId: string): Promise<StaffCardexInvoicesListResponse> {
    await connectMongo();
    const id = assertObjectId(cardexId, "cardexId");
    const Cardex = await getCardexModel();
    const cardex = await Cardex.findById(id).select({ _id: 1 }).lean().exec();
    if (!cardex) {
      throw new NotFoundException({
        code: CARDEX_INVOICE_STAFF_ERROR_CODES.CARDEX_NOT_FOUND,
        message: CARDEX_INVOICE_STAFF_ERROR_MESSAGES.CARDEX_NOT_FOUND,
      });
    }

    const Invoice = await getInvoiceModel();
    const rows = await Invoice.find({ cardexId: id }).sort({ issuedAt: -1, createdAt: -1 }).exec();

    const invoices = rows.map((row) => mapInvoice(row as InvoiceDoc));
    return StaffCardexInvoicesListResponseSchema.parse({ invoices });
  }

  /**
   * Strict membership: invoiceId must belong to cardexId.
   * Wrong cardex → same 404 as missing invoice (no existence leak).
   */
  async preparePdf(
    cardexId: string,
    invoiceId: string,
  ): Promise<{ pdf: Buffer; filename: string; reference: string }> {
    await connectMongo();
    const cid = assertObjectId(cardexId, "cardexId");
    const iid = assertObjectId(invoiceId, "invoiceId");

    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findOne({ _id: iid, cardexId: cid }).exec();
    if (!invoice) {
      throw new NotFoundException({
        code: CARDEX_INVOICE_STAFF_ERROR_CODES.INVOICE_NOT_FOUND,
        message: CARDEX_INVOICE_STAFF_ERROR_MESSAGES.INVOICE_NOT_FOUND,
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
}
