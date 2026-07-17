/**
 * Phase 1 — generate invoice PDF samples from real Mongo invoices (no email attach).
 *
 * Usage (from apps/vitrine/Backend):
 *   node --env-file=.env scripts/generate-invoice-pdf-samples.mjs
 *
 * Requires INVOICE_ISSUER_* (or pass via env for a one-shot demo).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright";

const ROOT = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(ROOT, "..");
const OUT_DIR = join(BACKEND_ROOT, "tmp", "invoice-pdf-samples");
const DIST = join(BACKEND_ROOT, "dist", "invoice-pdf");
const DB_PKG = join(BACKEND_ROOT, "..", "..", "..", "packages", "db");

const require = createRequire(import.meta.url);
const mongoose = require(require.resolve("mongoose", { paths: [DB_PKG] }));
const { MongoClient } = mongoose.mongo;
async function loadBuilt() {
  const mapper = await import(pathToFileURL(join(DIST, "invoice-pdf.mapper.js")).href);
  const logo = await import(pathToFileURL(join(DIST, "invoice-pdf.logo.js")).href);
  const issuer = await import(pathToFileURL(join(DIST, "invoice-issuer.config.js")).href);
  const template = await import(
    pathToFileURL(join(DIST, "templates", "invoice-proforma.html.js")).href
  );
  const bank = await import(
    pathToFileURL(join(BACKEND_ROOT, "dist", "booking", "bank-transfer.config.js")).href
  );
  return { mapper, logo, issuer, template, bank };
}

async function loadMongo() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_COWORK;
  if (!uri || !dbName) {
    throw new Error("MONGODB_URI / MONGODB_DB_COWORK required");
  }
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(dbName) };
}

async function htmlToPdf(html) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "14mm", left: "12mm" },
    });
    // Preview PNG of first page viewport for visual review
    await page.setViewportSize({ width: 794, height: 1123 });
    const png = await page.screenshot({ fullPage: true, type: "png" });
    await page.close();
    return { pdf: Buffer.from(pdf), png: Buffer.from(png) };
  } finally {
    await browser.close();
  }
}

async function buildFromReference(ref, deps, db) {
  const invoice = await db.collection("invoices").findOne({ reference: ref });
  if (!invoice) throw new Error(`Invoice ${ref} not found`);
  const cardex = await db.collection("cardex").findOne({ _id: invoice.cardexId });
  if (!cardex) throw new Error(`Cardex for ${ref} not found`);
  let reservationReference;
  let awaitingPaymentMethod;
  if (invoice.reservationId) {
    const reservation = await db.collection("reservations").findOne({ _id: invoice.reservationId });
    reservationReference = reservation?.reference;
    awaitingPaymentMethod = reservation?.awaitingPaymentMethod;
  }
  const payment = await db
    .collection("payments")
    .find({ invoiceId: invoice._id })
    .sort({ receivedAt: -1 })
    .limit(1)
    .next();

  const issuerConfig = deps.issuer.loadInvoiceIssuerConfig();
  if (!issuerConfig) {
    throw new Error("INVOICE_ISSUER_* incomplete — set issuer env before generating samples");
  }

  return deps.mapper.buildInvoicePdfViewModel({
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
    issuer: issuerConfig,
    logoDataUri: deps.logo.loadInvoiceLogoDataUri(),
    reservationReference,
    paymentMethod: payment?.method,
    awaitingPaymentMethod,
    bankRib: deps.bank.loadBankTransferRibConfig(),
  });
}

function buildStressFixture(deps) {
  const issuerConfig = deps.issuer.loadInvoiceIssuerConfig();
  return deps.mapper.buildInvoicePdfViewModel({
    invoice: {
      reference: "PF-2026-STRESS",
      type: "proforma",
      status: "proforma",
      issuedAt: new Date("2026-07-17T10:00:00.000Z"),
      dueDate: new Date("2026-07-25T00:00:00.000Z"),
      lines: [
        {
          label: "FOCUS — configuration modulable premium avec marquage directionnel",
          qty: 1,
          unitPriceHT: 18000,
          vatRate: 20,
          discount: 3600,
          totalHT: 14400,
        },
        {
          label: "Café premium",
          qty: 8,
          unitPriceHT: 1999,
          vatRate: 20,
          discount: 800,
          totalHT: 15192,
        },
        {
          label:
            "Plateau repas traiteur végétarien longue dénomination commerciale pour comité de direction",
          qty: 6,
          unitPriceHT: 2500,
          vatRate: 10,
          discount: 0,
          totalHT: 15000,
        },
        {
          label: "Vidéoprojecteur 4K",
          qty: 1,
          unitPriceHT: 4500,
          vatRate: 20,
          discount: 0,
          totalHT: 4500,
        },
        {
          label: "Paperboard + fournitures",
          qty: 3,
          unitPriceHT: 800,
          vatRate: 20,
          discount: 0,
          totalHT: 2400,
        },
        {
          label: "Accueil café d'accueil prolongé matinée",
          qty: 1,
          unitPriceHT: 3500,
          vatRate: 20,
          discount: 0,
          totalHT: 3500,
        },
        {
          label: "Location matériel visioconférence hybride",
          qty: 1,
          unitPriceHT: 6000,
          vatRate: 20,
          discount: 0,
          totalHT: 6000,
        },
      ],
      vatBreakdown: [
        { rate: 20, baseHT: 45992, vat: 9198 },
        { rate: 10, baseHT: 15000, vat: 1500 },
      ],
      totals: {
        ht: 60992,
        vat: 10698,
        ttc: 71690,
        discountTotal: 4400,
        balanceDue: 71690,
      },
    },
    cardex: {
      identity: { firstName: "Camille", lastName: "Bernard" },
      company: {
        legalName:
          "Société Européenne de Conseil Stratégique et d'Innovation Digitale Appliquée SASU",
        siret: "12345678901234",
        vatNumber: "FR12345678901",
        billingAddress: {
          street: "12 rue de la République, Bâtiment A, 3e étage, Bureau 312",
          zip: "69002",
          city: "Lyon",
          country: "FR",
        },
      },
    },
    issuer: issuerConfig,
    logoDataUri: deps.logo.loadInvoiceLogoDataUri(),
    reservationReference: "RES-2026-STRESS",
    awaitingPaymentMethod: "bank_transfer",
    bankRib: deps.bank.loadBankTransferRibConfig(),
  });
}

async function writeSample(slug, model, deps) {
  const html = deps.template.renderInvoiceProformaHtml(model);
  const { pdf, png } = await htmlToPdf(html);
  const pdfPath = join(OUT_DIR, `${slug}.pdf`);
  const pngPath = join(OUT_DIR, `${slug}.png`);
  const htmlPath = join(OUT_DIR, `${slug}.html`);
  writeFileSync(pdfPath, pdf);
  writeFileSync(pngPath, png);
  writeFileSync(htmlPath, html);
  console.log(`Wrote ${pdfPath} (${pdf.length} bytes) + preview ${pngPath}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const deps = await loadBuilt();
  const { client, db } = await loadMongo();
  try {
    const simple = await buildFromReference("PF-2026-00022", deps, db);
    await writeSample("01-simple-space-only-PF-2026-00022", simple, deps);

    const rich = await buildFromReference("PF-2026-00020", deps, db);
    await writeSample("02-rich-promo-PF-2026-00020", rich, deps);

    const pendingBt = await buildFromReference("PF-2026-00018", deps, db);
    await writeSample("03-bank-transfer-pending-PF-2026-00018", pendingBt, deps);

    const stress = buildStressFixture(deps);
    await writeSample("04-stress-many-lines-long-names", stress, deps);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
