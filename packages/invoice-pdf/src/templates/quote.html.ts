import { escapeEmailHtml, formatEmailEuro } from "@coworkprysme/shared";

import type { QuotePdfViewModel } from "../quote-pdf.types.js";

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

function paymentMethodLabel(method: QuotePdfViewModel["paymentMethod"]): string {
  if (method === "card") return "Carte bancaire";
  if (method === "bank_transfer") return "Virement bancaire";
  if (method === "direct_debit") return "Prélèvement SEPA (sur confirmation)";
  return "À définir";
}

/** Shared legal notice for devis conditions (distinct document from proforma invoice). */
export const QUOTE_PDF_VALIDITY_NOTICE =
  "Ce devis est valable jusqu’à la date indiquée. Passé ce délai, les tarifs et disponibilités pourront être révisés.";

export function renderQuotePdfHtml(model: QuotePdfViewModel): string {
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

  const depositRow =
    model.depositPercent > 0 && model.depositAmountTTC !== undefined
      ? `<tr><td>Acompte (${escapeHtml(String(model.depositPercent))}&nbsp;%)</td><td class="totals-num">${escapeHtml(formatEuro(model.depositAmountTTC))}</td></tr>`
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
        </div>`
      : "";

  const conditionsBlock = model.publicConditions
    ? `<p class="conditions-text">${escapeHtml(model.publicConditions)}</p>`
    : "";

  const termsBlock = model.paymentTermsLabel
    ? `<p><strong>Conditions de paiement :</strong> ${escapeHtml(model.paymentTermsLabel)}</p>`
    : "";

  const contactBits = [model.issuer.email, model.issuer.phone].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Devis ${escapeHtml(model.quoteReference)}</title>
  <style>
    @page { size: A4; margin: 10mm 12mm 12mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: #1a1a1a;
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.35;
    }
    .page { width: 100%; }
    .copper { color: #B87333; }
    .muted { color: #666; font-size: 9pt; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 0.02em; }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      padding-bottom: 10px;
      border-bottom: 2px solid #B87333;
    }
    .brand {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      max-width: 58%;
    }
    .logo {
      display: block;
      height: 40px;
      width: auto;
      max-width: 200px;
      object-fit: contain;
      object-position: left center;
    }
    .issuer { font-size: 9pt; line-height: 1.35; word-break: break-word; }
    .issuer strong { font-size: 10.5pt; }
    .doc-meta { text-align: right; min-width: 38%; }
    .doc-kind {
      display: inline-block;
      margin-bottom: 6px;
      padding: 3px 9px;
      border: 1px solid #B87333;
      border-radius: 999px;
      color: #B87333;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .doc-title { margin: 0 0 4px; font-size: 16pt; font-weight: 700; }
    .doc-meta ul { list-style: none; margin: 8px 0 0; padding: 0; font-size: 9pt; }
    .doc-meta li { margin: 2px 0; }
    .parties {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin: 16px 0 14px;
    }
    .party { width: 48%; }
    .party-label {
      margin: 0 0 4px;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #888;
    }
    .client-name { font-weight: 700; font-size: 11pt; }
    table.lines {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 14px;
      font-size: 9.5pt;
    }
    table.lines th {
      text-align: left;
      padding: 6px 4px;
      border-bottom: 1px solid #ccc;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #555;
    }
    table.lines td {
      padding: 7px 4px;
      border-bottom: 1px solid #eee;
      vertical-align: top;
    }
    .col-desc { width: 42%; }
    .col-qty { width: 22%; }
    .col-qty-period { font-size: 8.5pt; }
    .col-num { width: 12%; text-align: right; white-space: nowrap; }
    .line-label { font-weight: 600; }
    .line-discount { color: #666; font-size: 8.5pt; margin-top: 2px; }
    .summary {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      margin-top: 8px;
    }
    .vat-box, .totals-box { width: 48%; }
    .section-title {
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #888;
      margin-bottom: 6px;
    }
    table.vat, table.totals { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    table.vat th, table.vat td, table.totals td { padding: 4px 0; }
    .vat-rate { text-align: left; }
    .vat-base, .vat-amount, .totals-num { text-align: right; white-space: nowrap; }
    table.totals tr.grand td { font-weight: 700; font-size: 11pt; padding-top: 8px; border-top: 1px solid #ccc; }
    .conditions {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 9pt;
    }
    .accept-box {
      margin-top: 16px;
      padding: 12px 14px;
      border: 1px solid #B87333;
      border-radius: 8px;
      background: #faf6f2;
    }
    .accept-box a {
      color: #B87333;
      font-weight: 700;
      font-size: 11pt;
      text-decoration: none;
    }
    .accept-url {
      margin-top: 6px;
      font-size: 8pt;
      word-break: break-all;
      color: #666;
    }
    .payment-rib { margin-top: 12px; font-size: 9pt; }
    .rib-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 14px;
      margin-top: 6px;
    }
    .footer {
      margin-top: 22px;
      padding-top: 8px;
      border-top: 1px solid #eee;
      font-size: 8pt;
      color: #777;
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="brand">
        ${
          model.logoDataUri
            ? `<img class="logo" src="${escapeHtml(model.logoDataUri)}" alt="" />`
            : ""
        }
        <div class="issuer">
          <strong>${escapeHtml(model.issuer.legalName)}</strong>
          ${model.issuer.legalForm ? `<div class="muted">${escapeHtml(model.issuer.legalForm)}${model.issuer.shareCapital ? ` — capital ${escapeHtml(model.issuer.shareCapital)}` : ""}</div>` : ""}
          <div>${issuerAddress}</div>
          ${model.issuer.siret ? `<div class="muted">SIRET ${escapeHtml(model.issuer.siret)}</div>` : ""}
          ${model.issuer.vatNumber ? `<div class="muted">TVA ${escapeHtml(model.issuer.vatNumber)}</div>` : ""}
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-kind">${escapeHtml(model.documentKindLabel)}</div>
        <h1 class="doc-title">${escapeHtml(model.quoteReference)}</h1>
        <ul>
          <li><strong>Émis le</strong> ${escapeHtml(formatFrDate(model.issuedAt))}</li>
          <li><strong>Valable jusqu’au</strong> ${escapeHtml(formatFrDate(model.validUntil))}</li>
          <li><strong>Paiement</strong> ${escapeHtml(paymentMethodLabel(model.paymentMethod))}</li>
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
            ${depositRow}
          </tbody>
        </table>
      </div>
    </section>

    <section class="conditions" aria-label="Conditions">
      <div class="section-title">Conditions</div>
      <p>${escapeHtml(QUOTE_PDF_VALIDITY_NOTICE)}</p>
      <p><strong>Mode de paiement souhaité :</strong> ${escapeHtml(paymentMethodLabel(model.paymentMethod))}</p>
      ${termsBlock}
      ${conditionsBlock}
      ${bankBlock}
    </section>

    <section class="accept-box" aria-label="Accepter le devis">
      <a href="${escapeHtml(model.acceptUrl)}">Accepter le devis</a>
      <div class="accept-url">${escapeHtml(model.acceptUrl)}</div>
    </section>

    <footer class="footer">
      ${escapeHtml(model.issuer.legalName)}
      ${contactBits ? ` · ${escapeHtml(contactBits)}` : ""}
      ${model.issuer.rcs ? ` · ${escapeHtml(model.issuer.rcs)}` : ""}
    </footer>
  </div>
</body>
</html>`;
}
