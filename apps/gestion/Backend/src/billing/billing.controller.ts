import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  BankTransferPendingLookupResponseSchema,
  MarkBankTransferReceivedRequestSchema,
  MarkBankTransferReceivedResponseSchema,
} from "@coworkprysme/shared";
import type { Request } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { BillingPermissionGuard } from "../auth/billing-permission.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { StaffContextService } from "../auth/staff-context.service.js";
import { BillingService } from "./billing.service.js";

@Controller("billing")
@UseGuards(SessionGuard, BillingPermissionGuard)
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly staffContext: StaffContextService,
  ) {}

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
