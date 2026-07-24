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

import { loadInvoicePdfBankRib } from "./invoice-pdf.bank-rib.js";
import { loadInvoiceIssuerConfig } from "./invoice-issuer.config.js";
import { loadInvoiceLogoDataUri } from "./invoice-pdf.logo.js";
import { buildInvoicePdfViewModel } from "./invoice-pdf.mapper.js";
import type { InvoicePdfViewModel } from "./invoice-pdf.types.js";
import type { QuotePdfViewModel } from "./quote-pdf.types.js";
import { renderInvoiceProformaHtml } from "./templates/invoice-proforma.html.js";
import { renderQuotePdfHtml } from "./templates/quote.html.js";

/**
 * Proforma PDF generation.
 * Gate is invoice.type === "proforma" only — status paid / unpaid / awaiting all work.
 */
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

  /** Devis PDF from a prepared view model (no DB load — caller maps Quote → model). */
  async generatePdfForQuoteViewModel(model: QuotePdfViewModel): Promise<{
    pdf: Buffer;
    model: QuotePdfViewModel;
    html: string;
  }> {
    const html = renderQuotePdfHtml(model);
    const pdf = await this.htmlToPdf(html);
    return { pdf, model, html };
  }

  async htmlToPdf(html: string): Promise<Buffer> {
    try {
      return await this.renderPdfWithBrowser(html);
    } catch (error) {
      if (!isBrowserClosedError(error)) {
        throw error;
      }
      this.logger.warn(
        "Playwright browser closed mid-render — clearing cached instance and retrying once",
      );
      await this.resetBrowser();
      return await this.renderPdfWithBrowser(html);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.resetBrowser();
  }

  private async renderPdfWithBrowser(html: string): Promise<Buffer> {
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
      await page.close().catch(() => undefined);
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
        message: "Seules les factures de type proforma sont supportées pour le PDF",
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
    let reservationStartAt: Date | undefined;
    let reservationEndAt: Date | undefined;
    if (invoice.reservationId) {
      const Reservation = await getReservationModel();
      const reservation = await Reservation.findById(invoice.reservationId).lean().exec();
      reservationReference = reservation?.reference;
      awaitingPaymentMethod = reservation?.awaitingPaymentMethod;
      reservationStartAt = reservation?.startAt;
      reservationEndAt = reservation?.endAt;
    }

    const Payment = await getPaymentModel();
    const payment = await Payment.findOne({ invoiceId: invoice._id })
      .sort({ receivedAt: -1 })
      .lean()
      .exec();
    const paymentMethod = payment?.method;

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
      reservationStartAt,
      reservationEndAt,
      paymentMethod,
      awaitingPaymentMethod,
      bankRib: loadInvoicePdfBankRib(),
    });
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browserPromise) {
      try {
        const existing = await this.browserPromise;
        if (existing.isConnected()) {
          return existing;
        }
        this.logger.warn("Playwright browser disconnected — relaunching");
      } catch (error) {
        this.logger.warn(`Cached Playwright browser unusable — relaunching: ${String(error)}`);
      }
      this.browserPromise = null;
    }

    this.browserPromise = chromium
      .launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })
      .catch((error) => {
        this.browserPromise = null;
        throw error;
      });

    return this.browserPromise;
  }

  private async resetBrowser(): Promise<void> {
    const pending = this.browserPromise;
    this.browserPromise = null;
    if (!pending) return;
    try {
      const browser = await pending;
      await browser.close();
    } catch (error) {
      this.logger.warn(`Failed to close Playwright browser: ${String(error)}`);
    }
  }
}

function isBrowserClosedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /Target page, context or browser has been closed/i.test(message) ||
    /Browser\.hasBeenClosed/i.test(message)
  );
}
