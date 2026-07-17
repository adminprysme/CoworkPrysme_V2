/**
 * Shared transactional email chrome for Cowork Prysme (vitrine-api + gestion-api).
 * Keep header/footer/brand tokens identical so the client journey feels consistent.
 */

export const EMAIL_BRAND_COPPER = "#B87333";
export const EMAIL_BRAND_DARK = "#1a1a1a";
export const EMAIL_DEFAULT_PUBLIC_SITE_URL = "https://coworkprysme.eu";

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function resolvePublicSiteUrl(siteUrl?: string): string {
  const raw =
    siteUrl?.trim() || process.env.PUBLIC_SITE_URL?.trim() || EMAIL_DEFAULT_PUBLIC_SITE_URL;
  return raw.replace(/\/$/, "");
}

export function siteHostname(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return "coworkprysme.eu";
  }
}

export function formatEmailEuro(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function renderCoworkEmailLayout(
  title: string,
  bodyHtml: string,
  siteUrl: string,
  options?: { staffNotification?: boolean },
): string {
  const host = escapeEmailHtml(siteHostname(siteUrl));
  const headerTitle = options?.staffNotification
    ? `<p style="margin:0 0 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Notification interne</p>
          <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:normal;">Cowork Prysme — Gestion</h1>`
    : `<h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:normal;">Cowork Prysme</h1>`;
  const footer = options?.staffNotification
    ? `Notification staff — Cowork Prysme — ${host}`
    : `Cowork Prysme — ${host}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>${escapeEmailHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f3ef;font-family:Georgia,'Times New Roman',serif;color:${EMAIL_BRAND_DARK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ef;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8dfd4;border-radius:8px;overflow:hidden;">
        <tr><td style="background:${EMAIL_BRAND_COPPER};padding:20px 28px;">
          ${headerTitle}
        </td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px 24px;font-size:12px;color:#666;border-top:1px solid #eee;">
          ${footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Detail row used in confirmation / staff tables. */
export function emailDetailRow(
  label: string,
  valueHtml: string,
  options?: { last?: boolean },
): string {
  const border = options?.last ? "" : "border-bottom:1px solid #eee;";
  return `<tr>
        <td style="padding:6px 0;${border}width:38%;color:#666;">${escapeEmailHtml(label)}</td>
        <td style="padding:6px 0;${border}">${valueHtml}</td>
      </tr>`;
}

export interface PaymentConfirmedBuildingAccess {
  name: string;
  addressFull: string;
  accessInfo?: string | null;
  buildingAccessCode?: string | null;
  conciergeAccessCode?: string | null;
  conciergeUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export function renderFullAccessPlanSection(
  building: PaymentConfirmedBuildingAccess,
  siteUrl: string,
): string {
  const contactHref = `${siteUrl}/contact`;
  const contactHostLabel = `${siteHostname(siteUrl)}/contact`;
  const items: string[] = [
    `<li style="margin:0 0 6px;"><strong>Adresse :</strong> ${escapeEmailHtml(building.addressFull)}</li>`,
  ];

  const accessInfo = building.accessInfo?.trim();
  if (accessInfo) {
    items.push(
      `<li style="margin:0 0 6px;"><strong>Instructions d'accès :</strong> ${escapeEmailHtml(accessInfo).replaceAll("\n", "<br>")}</li>`,
    );
  }
  const buildingAccessCode = building.buildingAccessCode?.trim();
  if (buildingAccessCode) {
    items.push(
      `<li style="margin:0 0 6px;"><strong>Code d'accès :</strong> ${escapeEmailHtml(buildingAccessCode)}</li>`,
    );
  }
  const conciergeAccessCode = building.conciergeAccessCode?.trim();
  if (conciergeAccessCode) {
    items.push(
      `<li style="margin:0 0 6px;"><strong>Code conciergerie :</strong> ${escapeEmailHtml(conciergeAccessCode)}</li>`,
    );
  }
  const conciergeUrl = building.conciergeUrl?.trim();
  if (conciergeUrl) {
    items.push(
      `<li style="margin:0 0 6px;"><strong>Conciergerie :</strong> <a href="${escapeEmailHtml(conciergeUrl)}" style="color:${EMAIL_BRAND_COPPER};">${escapeEmailHtml(conciergeUrl)}</a></li>`,
    );
  }

  const contactParts: string[] = [];
  const contactEmail = building.contactEmail?.trim();
  const contactPhone = building.contactPhone?.trim();
  if (contactEmail) {
    contactParts.push(
      `<a href="mailto:${escapeEmailHtml(contactEmail)}" style="color:${EMAIL_BRAND_COPPER};">${escapeEmailHtml(contactEmail)}</a>`,
    );
  }
  if (contactPhone) {
    contactParts.push(escapeEmailHtml(contactPhone));
  }
  if (contactParts.length > 0) {
    items.push(
      `<li style="margin:0 0 6px;"><strong>Contact sur place :</strong> ${contactParts.join(" · ")}</li>`,
    );
  }

  return `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e8dfd4;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#666;">Plan d'accès</p>
      <p style="margin:0 0 10px;"><strong>${escapeEmailHtml(building.name)}</strong></p>
      <ul style="padding-left:20px;margin:0 0 12px;">
        ${items.join("\n        ")}
      </ul>
      <p style="margin:0;font-size:13px;color:#666;">Retrouvez aussi nos instructions détaillées sur
      <a href="${escapeEmailHtml(contactHref)}" style="color:${EMAIL_BRAND_COPPER};">${escapeEmailHtml(contactHostLabel)}</a>.</p>
    </div>
  `;
}

export type PaymentConfirmedMethod = "card" | "bank_transfer";

export interface PaymentConfirmedEmailInput {
  reservationReference: string;
  invoiceReference: string;
  spaceName: string;
  startAt: string;
  endAt: string;
  totalTTC: number;
  paymentMethod: PaymentConfirmedMethod;
  building: PaymentConfirmedBuildingAccess;
  siteUrl?: string;
  /** Optional pricing lines (card confirmation). */
  lines?: Array<{ label: string; qty: number; totalTTC: number }>;
  vatBreakdown?: Array<{ rate: number; baseHT: number; vat: number }>;
}

/**
 * Final confirmation after payment is received (card webhook or bank-transfer mark-received).
 * Same chrome as bank-transfer instructions / staff notifications.
 */
export function renderPaymentConfirmedEmail(input: PaymentConfirmedEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl(input.siteUrl);
  const lead =
    input.paymentMethod === "bank_transfer"
      ? "Nous avons bien reçu votre virement. Votre réservation est désormais <strong>confirmée</strong>."
      : "Votre paiement par carte a bien été enregistré. Votre réservation est <strong>confirmée</strong>.";

  const lines = input.lines ?? [];
  const vatBreakdown = input.vatBreakdown ?? [];
  const linesHtml =
    lines.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${lines
        .map(
          (line) => `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;">${escapeEmailHtml(line.label)}${line.qty > 1 ? ` × ${line.qty}` : ""}</td>
          <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;">${formatEmailEuro(line.totalTTC)}</td>
        </tr>`,
        )
        .join("")}
      <tr>
        <td style="padding:10px 0;font-weight:bold;">Total TTC</td>
        <td style="padding:10px 0;text-align:right;font-weight:bold;color:${EMAIL_BRAND_COPPER};">${formatEmailEuro(input.totalTTC)}</td>
      </tr>
    </table>`
      : "";

  const vatHtml =
    vatBreakdown.length > 0
      ? `<p style="margin:16px 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#666;">Ventilation TVA</p>
    <ul style="padding-left:20px;margin:0 0 8px;">${vatBreakdown
      .map(
        (line) =>
          `<li>TVA ${line.rate} % — base ${formatEmailEuro(line.baseHT)} : ${formatEmailEuro(line.vat)}</li>`,
      )
      .join("")}</ul>`
      : "";

  const body = `
    <p style="margin-top:0;">${lead}</p>
    <p style="margin:16px 0;padding:10px 14px;background:#f6f3ef;border-radius:6px;border-left:4px solid ${EMAIL_BRAND_COPPER};">
      <strong style="color:${EMAIL_BRAND_COPPER};">Statut : confirmée</strong>
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      ${emailDetailRow("Référence", `<strong>${escapeEmailHtml(input.reservationReference)}</strong>`)}
      ${emailDetailRow("Facture proforma", escapeEmailHtml(input.invoiceReference))}
      ${emailDetailRow("Espace", escapeEmailHtml(input.spaceName))}
      ${emailDetailRow("Créneau", `Du ${escapeEmailHtml(input.startAt)} au ${escapeEmailHtml(input.endAt)}`)}
      ${emailDetailRow(
        "Montant TTC",
        `<strong style="color:${EMAIL_BRAND_COPPER};">${formatEmailEuro(input.totalTTC)}</strong>`,
        { last: true },
      )}
    </table>
    ${linesHtml}
    ${vatHtml}
    ${renderFullAccessPlanSection(input.building, siteUrl)}
    <p style="margin:24px 0 0;">Merci et à bientôt au Cowork Prysme.</p>
  `;

  return {
    subject: `Réservation confirmée — ${input.reservationReference} — Cowork Prysme`,
    html: renderCoworkEmailLayout("Réservation confirmée", body, siteUrl),
  };
}
