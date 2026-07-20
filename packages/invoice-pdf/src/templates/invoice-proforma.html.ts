import { escapeEmailHtml, formatEmailEuro } from "@coworkprysme/shared";

import type { InvoicePdfViewModel } from "../invoice-pdf.types.js";

/** Exact legal wording — do not paraphrase (Code de commerce art. L.441-10). */
export const INVOICE_LATE_PAYMENT_LEGAL_NOTICE =
  "En cas de retard de paiement, seront exigibles des pénalités de retard calculées sur la base du taux d'intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente majoré de 10 points de pourcentage, ainsi qu'une indemnité forfaitaire pour frais de recouvrement d'un montant de 40 euros (article L.441-10 du Code de commerce).";

function escapeHtml(value: string): string {
  return escapeEmailHtml(value);
}

function formatEuro(cents: number): string {
  return formatEmailEuro(cents);
}

function formatFrDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(date);
}

function paymentMethodLabel(method: InvoicePdfViewModel["paymentMethod"]): string {
  if (method === "card") return "Carte bancaire";
  if (method === "bank_transfer") return "Virement bancaire";
  return "Non renseigné";
}

function paymentStatusLabel(status: InvoicePdfViewModel["paymentStatus"]): string {
  if (status === "paid") return "Payé";
  if (status === "awaiting") return "En attente de paiement";
  return "Autre";
}

export function renderInvoiceProformaHtml(model: InvoicePdfViewModel): string {
  const issuerAddress = [model.issuer.addressLine1, model.issuer.addressLine2]
    .filter(Boolean)
    .map((line) => escapeHtml(line!))
    .join("<br>");

  const clientSecondary = model.client.secondaryLines
    .map((line) => `<div class="muted">${escapeHtml(line)}</div>`)
    .join("");
  const clientAddress = model.client.addressLines
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");

  const lineRows = model.lines
    .map((line) => {
      const discountNote =
        line.discount > 0
          ? `<div class="line-discount">Remise −${escapeHtml(formatEuro(line.discount))}</div>`
          : "";
      const qtyClass = line.kind === "space" ? "col-qty col-qty-period" : "col-qty";
      return `<tr>
        <td class="col-desc">
          <div class="line-label">${escapeHtml(line.label)}</div>
          ${discountNote}
        </td>
        <td class="${qtyClass}">${escapeHtml(line.qtyOrPeriodLabel)}</td>
        <td class="col-num">${escapeHtml(formatEuro(line.unitPriceHT))}</td>
        <td class="col-num">${escapeHtml(String(line.vatRate))}&nbsp;%</td>
        <td class="col-num">${escapeHtml(formatEuro(line.totalHT))}</td>
      </tr>`;
    })
    .join("");

  const vatRows = model.vatBreakdown
    .map(
      (row) => `<tr>
        <td class="vat-rate">TVA ${escapeHtml(String(row.rate))}&nbsp;%</td>
        <td class="vat-base">${escapeHtml(formatEuro(row.baseHT))}</td>
        <td class="vat-amount">${escapeHtml(formatEuro(row.vat))}</td>
      </tr>`,
    )
    .join("");

  const discountTotalRow =
    model.totals.discountTotal > 0
      ? `<tr><td>Remises</td><td class="totals-num">−${escapeHtml(formatEuro(model.totals.discountTotal))}</td></tr>`
      : "";

  const bankBlock =
    model.paymentMethod === "bank_transfer" && model.bankRib
      ? `<div class="payment-rib">
          <div class="section-title">Coordonnées de virement</div>
          <div class="rib-grid">
            <div><span class="muted">Titulaire</span><br><strong>${escapeHtml(model.bankRib.accountHolder)}</strong></div>
            <div><span class="muted">IBAN</span><br><strong class="mono">${escapeHtml(model.bankRib.iban)}</strong></div>
            <div><span class="muted">BIC</span><br><strong class="mono">${escapeHtml(model.bankRib.bic)}</strong></div>
            ${
              model.bankRib.bankName
                ? `<div><span class="muted">Banque</span><br><strong>${escapeHtml(model.bankRib.bankName)}</strong></div>`
                : ""
            }
          </div>
          ${
            model.reservationReference
              ? `<p class="rib-ref">Merci d’indiquer la référence <strong>${escapeHtml(model.reservationReference)}</strong> en motif de virement.</p>`
              : ""
          }
        </div>`
      : "";

  const contactBits = [model.issuer.email, model.issuer.phone].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Proforma ${escapeHtml(model.invoiceReference)}</title>
  <style>
    @page { size: A4; margin: 14mm 14mm 16mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: #1a1a1a;
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.45;
    }
    .page {
      width: 100%;
    }
    .copper { color: #B87333; }
    .muted { color: #666; font-size: 9.5pt; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 0.02em; }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 2px solid #B87333;
    }
    .brand {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
      max-width: 58%;
    }
    .logo {
      display: block;
      height: 48px;
      width: auto;
      max-width: 220px;
      object-fit: contain;
      object-position: left center;
    }
    .issuer {
      font-size: 9.5pt;
      line-height: 1.4;
      word-break: break-word;
    }
    .issuer strong { font-size: 11pt; }
    .doc-meta {
      text-align: right;
      min-width: 38%;
    }
    .doc-kind {
      display: inline-block;
      margin-bottom: 8px;
      padding: 4px 10px;
      border: 1px solid #B87333;
      border-radius: 999px;
      color: #B87333;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .doc-title {
      margin: 0 0 6px;
      font-size: 18pt;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .meta-list { margin: 0; padding: 0; list-style: none; font-size: 9.5pt; }
    .meta-list li { margin: 0 0 3px; }
    .parties {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin: 22px 0 18px;
    }
    .party {
      width: 48%;
      min-width: 0;
      word-break: break-word;
    }
    .party-label {
      margin: 0 0 6px;
      font-size: 8.5pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #B87333;
      font-weight: 700;
    }
    .client-name {
      font-size: 12pt;
      font-weight: 700;
      margin-bottom: 4px;
    }
    table.lines {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 6px;
    }
    table.lines thead { display: table-header-group; }
    table.lines th {
      background: #f6f3ef;
      color: #444;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      text-align: left;
      padding: 8px 8px;
      border-bottom: 1px solid #ddd;
    }
    table.lines td {
      padding: 9px 8px;
      border-bottom: 1px solid #eee;
      vertical-align: top;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    table.lines tr { page-break-inside: avoid; }
    .col-desc { width: 36%; }
    .col-qty {
      width: 24%;
      text-align: right;
      white-space: nowrap;
      vertical-align: top;
    }
    .col-qty-period {
      text-align: left;
      white-space: normal;
      word-break: break-word;
      overflow-wrap: anywhere;
      font-size: 8.5pt;
      line-height: 1.35;
      font-variant-numeric: tabular-nums;
    }
    .col-num { width: 13%; text-align: right; white-space: nowrap; }
    th.col-num, th.col-qty { text-align: right; }
    th.col-qty { text-align: left; }
    .line-label { font-weight: 600; }
    .line-discount { margin-top: 2px; color: #666; font-size: 9pt; }
    .summary {
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      gap: 28px;
      margin-top: 16px;
      page-break-inside: avoid;
    }
    .vat-box {
      min-width: 300px;
      flex: 1 1 auto;
      max-width: 360px;
    }
    .totals-box {
      min-width: 240px;
      flex: 0 0 auto;
      padding: 12px 14px;
      background: #f6f3ef;
      border-radius: 8px;
      border-left: 4px solid #B87333;
      /* Isolate from neighbouring table borders in Chromium print. */
      isolation: isolate;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .section-title {
      margin: 0 0 8px;
      font-size: 8.5pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #B87333;
      font-weight: 700;
    }
    /* Explicit 3-column VAT grid — never concatenate base + VAT amounts. */
    table.vat {
      width: 100%;
      border-collapse: collapse;
      border-spacing: 0;
      font-size: 9.5pt;
      table-layout: fixed;
      border: none;
    }
    table.vat th,
    table.vat td {
      border: none !important;
      border-top: none !important;
      border-bottom: none !important;
      border-left: none !important;
      border-right: none !important;
      background: transparent;
      vertical-align: baseline;
      padding: 5px 0;
    }
    table.vat thead th {
      color: #888;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding-bottom: 6px;
    }
    table.vat .vat-rate {
      width: 30%;
      padding-right: 14px;
      white-space: nowrap;
      font-weight: 600;
      text-align: left;
    }
    table.vat .vat-base,
    table.vat .vat-amount {
      width: 35%;
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    table.vat .vat-base {
      padding-right: 18px;
    }
    table.vat .vat-amount {
      padding-left: 18px;
      border-left: 1px solid #e0d8ce !important;
    }
    th.vat-amount {
      border-left: 1px solid #e0d8ce !important;
    }
    /* Totaux as borderless table — avoids flex hairlines in PDF engines. */
    table.totals {
      width: 100%;
      border-collapse: collapse;
      border-spacing: 0;
      border: none;
      font-size: 10pt;
    }
    table.totals td {
      border: none !important;
      border-top: none !important;
      border-bottom: none !important;
      padding: 6px 0;
      background: transparent;
      vertical-align: baseline;
    }
    table.totals .totals-num {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      padding-left: 16px;
    }
    table.totals tr.grand td {
      padding-top: 10px;
      font-size: 12pt;
      font-weight: 700;
      color: #B87333;
    }
    .payment {
      margin-top: 22px;
      padding: 14px 16px;
      border: 1px solid #e6e0d8;
      border-radius: 8px;
      page-break-inside: avoid;
    }
    .payment-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 18px 28px;
    }
    .payment-rib { margin-top: 12px; }
    .rib-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 18px;
      margin-top: 6px;
    }
    .rib-ref { margin: 10px 0 0; font-size: 9.5pt; color: #444; }
    .legal {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #555;
      line-height: 1.4;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="brand">
        <img class="logo" src="${model.logoDataUri}" alt="Cowork Prysme" />
        <div class="issuer">
          <strong>${escapeHtml(model.issuer.legalName)}</strong>
          <div class="muted">${escapeHtml(model.issuer.legalForm)} — Capital ${escapeHtml(model.issuer.shareCapital)}</div>
          <div>${issuerAddress}</div>
          <div class="muted">SIRET ${escapeHtml(model.issuer.siret)} · TVA ${escapeHtml(model.issuer.vatNumber)}</div>
          <div class="muted">${escapeHtml(model.issuer.rcs)}</div>
          ${contactBits ? `<div class="muted">${escapeHtml(contactBits)}</div>` : ""}
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-kind">${escapeHtml(model.documentKindLabel)}</div>
        <h1 class="doc-title">Facture</h1>
        <ul class="meta-list">
          <li><strong>Référence</strong> ${escapeHtml(model.invoiceReference)}</li>
          ${
            model.reservationReference
              ? `<li><strong>Réservation</strong> ${escapeHtml(model.reservationReference)}</li>`
              : ""
          }
          <li><strong>Émise le</strong> ${escapeHtml(formatFrDate(model.issuedAt))}</li>
          ${
            model.dueDate
              ? `<li><strong>Échéance</strong> ${escapeHtml(formatFrDate(model.dueDate))}</li>`
              : ""
          }
        </ul>
      </div>
    </header>

    <section class="parties">
      <div class="party">
        <p class="party-label">Émetteur</p>
        <div><strong>${escapeHtml(model.issuer.legalName)}</strong></div>
        <div>${issuerAddress}</div>
      </div>
      <div class="party">
        <p class="party-label">Client</p>
        <div class="client-name">${escapeHtml(model.client.displayName)}</div>
        ${clientSecondary}
        ${clientAddress}
      </div>
    </section>

    <table class="lines">
      <thead>
        <tr>
          <th class="col-desc">Description</th>
          <th class="col-qty">Qté / période</th>
          <th class="col-num">P.U. HT</th>
          <th class="col-num">TVA</th>
          <th class="col-num">Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows}
      </tbody>
    </table>

    <section class="summary">
      <div class="vat-box">
        <div class="section-title">Ventilation TVA</div>
        <table class="vat">
          <thead>
            <tr>
              <th class="vat-rate">Taux</th>
              <th class="vat-base">Base HT</th>
              <th class="vat-amount">Montant TVA</th>
            </tr>
          </thead>
          <tbody>
            ${vatRows}
          </tbody>
        </table>
      </div>
      <div class="totals-box">
        <div class="section-title">Totaux</div>
        <table class="totals">
          <tbody>
            ${discountTotalRow}
            <tr><td>Total HT</td><td class="totals-num">${escapeHtml(formatEuro(model.totals.ht))}</td></tr>
            <tr><td>Total TVA</td><td class="totals-num">${escapeHtml(formatEuro(model.totals.vat))}</td></tr>
            <tr class="grand"><td>Total TTC</td><td class="totals-num">${escapeHtml(formatEuro(model.totals.ttc))}</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="payment">
      <div class="section-title">Conditions de paiement</div>
      <div class="payment-grid">
        <div><span class="muted">Mode</span><br><strong>${escapeHtml(paymentMethodLabel(model.paymentMethod))}</strong></div>
        <div><span class="muted">Statut</span><br><strong>${escapeHtml(paymentStatusLabel(model.paymentStatus))}</strong></div>
      </div>
      ${bankBlock}
    </section>

    <footer class="legal">
      <p>${escapeHtml(INVOICE_LATE_PAYMENT_LEGAL_NOTICE)}</p>
      <p class="muted" style="margin-top:8px;">Document ${escapeHtml(model.documentKindLabel)} — n’a pas valeur de facture définitive jusqu’à la clôture du séjour.</p>
    </footer>
  </div>
</body>
</html>`;
}
