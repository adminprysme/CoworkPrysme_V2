import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  getCardexModel,
  getInvoiceModel,
  getPaymentModel,
  getReservationModel,
} from "@coworkprysme/db";
import { chromium, type Browser } from "playwright";

import { loadBankTransferRibConfig } from "../booking/bank-transfer.config.js";
import { loadInvoiceIssuerConfig } from "./invoice-issuer.config.js";
import { loadInvoiceLogoDataUri } from "./invoice-pdf.logo.js";
import { buildInvoicePdfViewModel } from "./invoice-pdf.mapper.js";
import type { InvoicePdfViewModel } from "./invoice-pdf.types.js";
import { renderInvoiceProformaHtml } from "./templates/invoice-proforma.html.js";

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);
  private browserPromise: Promise<Browser> | null = null;

  async renderHtmlForInvoiceReference(reference: string): Promise<{
    html: string;
    model: InvoicePdfViewModel;
  }> {
    const model = await this.buildViewModel(reference);
    return { html: renderInvoiceProformaHtml(model), model };
  }

  async generatePdfForInvoiceReference(reference: string): Promise<{
    pdf: Buffer;
    model: InvoicePdfViewModel;
    html: string;
  }> {
    const { html, model } = await this.renderHtmlForInvoiceReference(reference);
    const pdf = await this.htmlToPdf(html);
    return { pdf, model, html };
  }

  async htmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", right: "12mm", bottom: "14mm", left: "12mm" },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.browserPromise) return;
    try {
      const browser = await this.browserPromise;
      await browser.close();
    } catch (error) {
      this.logger.warn(`Failed to close Playwright browser: ${String(error)}`);
    } finally {
      this.browserPromise = null;
    }
  }

  private async buildViewModel(reference: string): Promise<InvoicePdfViewModel> {
    const issuer = loadInvoiceIssuerConfig();
    if (!issuer) {
      throw new ServiceUnavailableException({
        code: "INVOICE_ISSUER_NOT_CONFIGURED",
        message:
          "Identité émetteur incomplete — renseignez les variables INVOICE_ISSUER_* dans l’environnement",
      });
    }

    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findOne({ reference }).lean().exec();
    if (!invoice) {
      throw new NotFoundException({
        code: "INVOICE_NOT_FOUND",
        message: `Facture ${reference} introuvable`,
      });
    }
    if (invoice.type !== "proforma") {
      throw new BadRequestException({
        code: "INVOICE_TYPE_UNSUPPORTED",
        message: "Seules les factures de type proforma sont supportées pour le PDF Phase 1",
      });
    }

    const Cardex = await getCardexModel();
    const cardex = await Cardex.findById(invoice.cardexId).lean().exec();
    if (!cardex) {
      throw new NotFoundException({
        code: "CARDEX_NOT_FOUND",
        message: "Cardex client introuvable pour cette facture",
      });
    }

    let reservationReference: string | undefined;
    let awaitingPaymentMethod: string | undefined;
    if (invoice.reservationId) {
      const Reservation = await getReservationModel();
      const reservation = await Reservation.findById(invoice.reservationId).lean().exec();
      reservationReference = reservation?.reference;
      awaitingPaymentMethod = reservation?.awaitingPaymentMethod;
    }

    const Payment = await getPaymentModel();
    const payment = await Payment.findOne({ invoiceId: invoice._id })
      .sort({ receivedAt: -1 })
      .lean()
      .exec();
    const paymentMethod = payment?.method;

    const bankRib = loadBankTransferRibConfig();

    return buildInvoicePdfViewModel({
      invoice: {
        reference: invoice.reference,
        type: invoice.type,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        lines: invoice.lines,
        vatBreakdown: invoice.vatBreakdown,
        totals: invoice.totals,
      },
      cardex: {
        identity: cardex.identity,
        address: cardex.address,
        company: cardex.company,
      },
      issuer,
      logoDataUri: loadInvoiceLogoDataUri(),
      reservationReference,
      paymentMethod,
      awaitingPaymentMethod,
      bankRib,
    });
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
    return this.browserPromise;
  }
}
