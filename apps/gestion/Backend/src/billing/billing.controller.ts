import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  BankTransferPendingLookupResponseSchema,
  BankTransferTransfersQuerySchema,
  BankTransferTransfersResponseSchema,
  MarkBankTransferReceivedRequestSchema,
  MarkBankTransferReceivedResponseSchema,
  StaffBillingClientSearchQuerySchema,
  StaffBillingClientSearchResponseSchema,
  StaffBillingInvoiceListQuerySchema,
  StaffBillingInvoiceListResponseSchema,
} from "@coworkprysme/shared";
import type { Request, Response } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { BillingPermissionGuard } from "../auth/billing-permission.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { StaffContextService } from "../auth/staff-context.service.js";
import { BillingClientsService } from "./billing-clients.service.js";
import { BillingInvoicesService } from "./billing-invoices.service.js";
import { BillingService } from "./billing.service.js";

function contentDispositionAttachment(filename: string): string {
  const fallback =
    filename
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "_")
      .trim() || "facture.pdf";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

@Controller("billing")
@UseGuards(SessionGuard, BillingPermissionGuard)
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly billingClients: BillingClientsService,
    private readonly billingInvoices: BillingInvoicesService,
    private readonly staffContext: StaffContextService,
  ) {}

  @Get("clients/search")
  async searchClients(@Query() query: unknown) {
    const parsed = StaffBillingClientSearchQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid query");
    }
    const payload = await this.billingClients.searchClients(parsed.data.q);
    return StaffBillingClientSearchResponseSchema.parse(payload);
  }

  @Get("invoices")
  async listInvoices(@Query() query: unknown) {
    const parsed = StaffBillingInvoiceListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid query");
    }
    const payload = await this.billingInvoices.list(parsed.data);
    return StaffBillingInvoiceListResponseSchema.parse(payload);
  }

  @Get("invoices/:invoiceId/pdf")
  async downloadInvoicePdf(
    @Param("invoiceId") invoiceId: string,
    @Res() response: Response,
  ): Promise<void> {
    const prepared = await this.billingInvoices.preparePdf(invoiceId);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", contentDispositionAttachment(prepared.filename));
    response.setHeader("Content-Length", String(prepared.pdf.length));
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.end(prepared.pdf);
  }

  @Get("transfers")
  async listTransfers(@Query() query: unknown) {
    const parsed = BankTransferTransfersQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid query");
    }
    const payload = await this.billing.listTransfers(parsed.data.validatedDays);
    return BankTransferTransfersResponseSchema.parse(payload);
  }

  @Get("transfers/lookup")
  async lookup(@Query("reference") reference?: string) {
    if (!reference?.trim()) {
      throw new BadRequestException("Paramètre reference requis");
    }
    const payload = await this.billing.lookupPendingTransfer(reference);
    return BankTransferPendingLookupResponseSchema.parse(payload);
  }

  @Post("transfers/mark-received")
  async markReceivedByReference(@Body() body: unknown, @Req() request: Request) {
    const parsed = MarkBankTransferReceivedRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? "Invalid payload");
    }
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const payload = await this.billing.markTransferReceivedByReference(
      parsed.data.reference,
      profile._id.toString(),
      parsed.data.qontoTxId,
    );
    return MarkBankTransferReceivedResponseSchema.parse(payload);
  }

  @Post("invoices/:invoiceId/mark-transfer-received")
  async markReceivedByInvoiceId(@Param("invoiceId") invoiceId: string, @Req() request: Request) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    const payload = await this.billing.markTransferReceivedByInvoiceId(
      invoiceId,
      profile._id.toString(),
    );
    return MarkBankTransferReceivedResponseSchema.parse(payload);
  }
}
