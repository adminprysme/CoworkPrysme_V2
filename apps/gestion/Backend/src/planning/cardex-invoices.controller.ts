import { Controller, Get, Param, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { ClientsPermissionGuard } from "../auth/clients-permission.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { CardexInvoicesService } from "./cardex-invoices.service.js";

function contentDispositionAttachment(filename: string): string {
  const fallback =
    filename
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "_")
      .trim() || "facture.pdf";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

@Controller("planning/cardexes")
@UseGuards(SessionGuard, ClientsPermissionGuard)
export class CardexInvoicesController {
  constructor(private readonly invoices: CardexInvoicesService) {}

  @Get(":cardexId/invoices")
  async list(@Param("cardexId") cardexId: string) {
    return this.invoices.list(cardexId);
  }

  @Get(":cardexId/invoices/:invoiceId/pdf")
  async downloadPdf(
    @Param("cardexId") cardexId: string,
    @Param("invoiceId") invoiceId: string,
    @Res() response: Response,
  ): Promise<void> {
    const prepared = await this.invoices.preparePdf(cardexId, invoiceId);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", contentDispositionAttachment(prepared.filename));
    response.setHeader("Content-Length", String(prepared.pdf.length));
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.end(prepared.pdf);
  }
}
