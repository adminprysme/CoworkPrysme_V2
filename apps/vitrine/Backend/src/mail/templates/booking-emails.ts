const BRAND_COPPER = "#B87333";
const BRAND_DARK = "#1a1a1a";
const DEFAULT_PUBLIC_SITE_URL = "https://coworkprysme.eu";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function resolvePublicSiteUrl(siteUrl?: string): string {
  const raw = siteUrl?.trim() || process.env.PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_URL;
  return raw.replace(/\/$/, "");
}

function siteHostname(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return "coworkprysme.eu";
  }
}

function layout(
  title: string,
  bodyHtml: string,
  siteUrl: string,
  options?: { staffNotification?: boolean },
): string {
  const host = escapeHtml(siteHostname(siteUrl));
  const headerTitle = options?.staffNotification
    ? `<p style="margin:0 0 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Notification interne</p>
          <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:normal;">Cowork Prysme — Gestion</h1>`
    : `<h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:normal;">Cowork Prysme</h1>`;
  const footer = options?.staffNotification
    ? `Notification staff — Cowork Prysme — ${host}`
    : `Cowork Prysme — ${host}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f3ef;font-family:Georgia,'Times New Roman',serif;color:${BRAND_DARK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ef;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8dfd4;border-radius:8px;overflow:hidden;">
        <tr><td style="background:${BRAND_COPPER};padding:20px 28px;">
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

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export interface BookingConfirmationBuildingAccess {
  name: string;
  addressFull: string;
  accessInfo?: string | null;
  buildingAccessCode?: string | null;
  conciergeAccessCode?: string | null;
  conciergeUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

/** Maps a building document (or lean) to the email access block. */
export function buildingToEmailAccess(building: {
  name: string;
  email?: string | null;
  phone?: string | null;
  accessCode?: string | null;
  address: {
    street: string;
    zip: string;
    city: string;
    accessInfo?: string | null;
  };
  concierge?: {
    url?: string | null;
    accessCode?: string | null;
  } | null;
}): BookingConfirmationBuildingAccess {
  const accessInfo = building.address.accessInfo?.trim() || null;
  const locality = `${building.address.zip.trim()} ${building.address.city.trim()}`.trim();
  const addressFull = [building.address.street.trim(), locality].filter(Boolean).join(", ");

  return {
    name: building.name.trim(),
    addressFull,
    accessInfo,
    buildingAccessCode: building.accessCode?.trim() || null,
    conciergeAccessCode: building.concierge?.accessCode?.trim() || null,
    conciergeUrl: building.concierge?.url?.trim() || null,
    contactEmail: building.email?.trim() || null,
    contactPhone: building.phone?.trim() || null,
  };
}

export interface BookingConfirmationEmailInput {
  reservationReference: string;
  invoiceReference: string;
  spaceName: string;
  startAt: string;
  endAt: string;
  totalTTC: number;
  lines: Array<{ label: string; qty: number; totalTTC: number }>;
  vatBreakdown: Array<{ rate: number; baseHT: number; vat: number }>;
  building: BookingConfirmationBuildingAccess;
  siteUrl?: string;
}

function renderAccessPlanHtml(
  building: BookingConfirmationBuildingAccess,
  siteUrl: string,
  options: { includeSensitiveAccess: boolean } = { includeSensitiveAccess: true },
): string {
  const contactHref = `${siteUrl}/contact`;
  const contactHostLabel = `${siteHostname(siteUrl)}/contact`;
  const items: string[] = [
    `<li><strong>Adresse :</strong> ${escapeHtml(building.addressFull)}</li>`,
  ];

  if (options.includeSensitiveAccess) {
    const accessInfo = building.accessInfo?.trim();
    if (accessInfo) {
      items.push(
        `<li><strong>Instructions d'accès :</strong> ${escapeHtml(accessInfo).replaceAll("\n", "<br>")}</li>`,
      );
    }

    const buildingAccessCode = building.buildingAccessCode?.trim();
    if (buildingAccessCode) {
      items.push(`<li><strong>Code d'accès :</strong> ${escapeHtml(buildingAccessCode)}</li>`);
    }

    const conciergeAccessCode = building.conciergeAccessCode?.trim();
    if (conciergeAccessCode) {
      items.push(
        `<li><strong>Code conciergerie :</strong> ${escapeHtml(conciergeAccessCode)}</li>`,
      );
    }

    const conciergeUrl = building.conciergeUrl?.trim();
    if (conciergeUrl) {
      items.push(
        `<li><strong>Conciergerie :</strong> <a href="${escapeHtml(conciergeUrl)}" style="color:${BRAND_COPPER};">${escapeHtml(conciergeUrl)}</a></li>`,
      );
    }

    const contactParts: string[] = [];
    const contactEmail = building.contactEmail?.trim();
    const contactPhone = building.contactPhone?.trim();
    if (contactEmail) {
      contactParts.push(
        `<a href="mailto:${escapeHtml(contactEmail)}" style="color:${BRAND_COPPER};">${escapeHtml(contactEmail)}</a>`,
      );
    }
    if (contactPhone) {
      contactParts.push(escapeHtml(contactPhone));
    }
    if (contactParts.length > 0) {
      items.push(`<li><strong>Contact sur place :</strong> ${contactParts.join(" · ")}</li>`);
    }

    return `
    <p><strong>Plan d'accès — ${escapeHtml(building.name)}</strong></p>
    <ul style="padding-left:20px;margin:8px 0 16px;">
      ${items.join("\n      ")}
    </ul>
    <p>Retrouvez aussi nos instructions détaillées sur <a href="${escapeHtml(contactHref)}" style="color:${BRAND_COPPER};">${escapeHtml(contactHostLabel)}</a>.</p>
  `;
  }

  // Pre-payment: public address only — never codes, concierge URL, or detailed access instructions.
  return `
    <p><strong>${escapeHtml(building.name)}</strong></p>
    <ul style="padding-left:20px;margin:8px 0 16px;">
      ${items.join("\n      ")}
    </ul>
    <p>Les instructions d'accès détaillées (code conciergerie, etc.) vous seront envoyées
    <strong>après réception de votre paiement</strong>.</p>
  `;
}

export function renderBookingConfirmationEmail(input: BookingConfirmationEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl(input.siteUrl);
  const linesHtml = input.lines
    .map(
      (line) =>
        `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;">${escapeHtml(line.label)}${line.qty > 1 ? ` × ${line.qty}` : ""}</td>
          <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;">${formatEuro(line.totalTTC)}</td>
        </tr>`,
    )
    .join("");

  const vatHtml = input.vatBreakdown
    .map(
      (line) =>
        `<li>TVA ${line.rate} % — base ${formatEuro(line.baseHT)} : ${formatEuro(line.vat)}</li>`,
    )
    .join("");

  const body = `
    <p style="margin-top:0;">Votre réservation est confirmée.</p>
    <p><strong>Référence :</strong> ${escapeHtml(input.reservationReference)}<br>
    <strong>Facture proforma :</strong> ${escapeHtml(input.invoiceReference)}</p>
    <p><strong>${escapeHtml(input.spaceName)}</strong><br>
    Du ${escapeHtml(input.startAt)} au ${escapeHtml(input.endAt)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${linesHtml}
      <tr>
        <td style="padding:10px 0;font-weight:bold;">Total TTC</td>
        <td style="padding:10px 0;text-align:right;font-weight:bold;color:${BRAND_COPPER};">${formatEuro(input.totalTTC)}</td>
      </tr>
    </table>
    <p><strong>Ventilation TVA</strong></p>
    <ul style="padding-left:20px;margin:8px 0 20px;">${vatHtml}</ul>
    <p><strong>Facture proforma</strong><br>
    Les coordonnées bancaires (RIB) vous seront communiquées prochainement pour le règlement.</p>
    ${renderAccessPlanHtml(input.building, siteUrl)}
  `;

  return {
    subject: `Confirmation de réservation ${input.reservationReference} — Cowork Prysme`,
    html: layout("Confirmation de réservation", body, siteUrl),
  };
}

export function renderAccountCreatedEmail(input: { email: string; siteUrl?: string }): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl(input.siteUrl);
  const privacyHref = `${siteUrl}/politique-de-confidentialite`;
  const body = `
    <p style="margin-top:0;">Votre compte client Cowork Prysme a été créé avec l'adresse <strong>${escapeHtml(input.email)}</strong>.</p>
    <p>Vous pourrez bientôt vous connecter à votre espace client pour consulter vos réservations et factures.</p>
    <p>Consultez notre <a href="${escapeHtml(privacyHref)}" style="color:${BRAND_COPPER};">politique de confidentialité</a>.</p>
  `;

  return {
    subject: "Votre compte Cowork Prysme a été créé",
    html: layout("Compte créé", body, siteUrl),
  };
}

export interface StaffBookingNotificationEmailInput {
  reservationReference: string;
  invoiceReference: string;
  spaceName: string;
  buildingName: string;
  startAt: string;
  endAt: string;
  totalTTC: number;
  clientEmail: string;
  clientName?: string | null;
  paymentMethod: "proforma" | "card" | "bank_transfer";
  siteUrl?: string;
}

/** Internal staff notification — distinct tone from client confirmation. */
export function renderStaffBookingNotificationEmail(input: StaffBookingNotificationEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl(input.siteUrl);
  const paymentLabel =
    input.paymentMethod === "card"
      ? "Paiement par carte"
      : input.paymentMethod === "bank_transfer"
        ? "Virement bancaire"
        : "Facture proforma";
  const clientName = input.clientName?.trim();
  const clientLine = clientName
    ? `${escapeHtml(clientName)} (${escapeHtml(input.clientEmail)})`
    : escapeHtml(input.clientEmail);

  const body = `
    <p style="margin-top:0;">Une nouvelle réservation vient d'être confirmée sur la vitrine.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee;width:38%;color:#666;">Référence</td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;"><strong>${escapeHtml(input.reservationReference)}</strong></td>
      </tr>
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee;color:#666;">Facture proforma</td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;">${escapeHtml(input.invoiceReference)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee;color:#666;">Client</td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;">${clientLine}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee;color:#666;">Espace</td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;">${escapeHtml(input.spaceName)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee;color:#666;">Bâtiment</td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;">${escapeHtml(input.buildingName)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee;color:#666;">Créneau</td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;">Du ${escapeHtml(input.startAt)} au ${escapeHtml(input.endAt)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee;color:#666;">Montant TTC</td>
        <td style="padding:6px 0;border-bottom:1px solid #eee;color:${BRAND_COPPER};font-weight:bold;">${formatEuro(input.totalTTC)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#666;">Règlement</td>
        <td style="padding:6px 0;">${escapeHtml(paymentLabel)}</td>
      </tr>
    </table>
    <p style="margin-bottom:0;font-size:13px;color:#666;">Cet e-mail est destiné aux gestionnaires du bâtiment. Ne pas transférer au client.</p>
  `;

  return {
    subject: `Nouvelle réservation — ${input.spaceName} — ${input.startAt}`,
    html: layout("Nouvelle réservation", body, siteUrl, { staffNotification: true }),
  };
}

export interface BankTransferInstructionsEmailInput {
  reservationReference: string;
  invoiceReference: string;
  spaceName: string;
  startAt: string;
  endAt: string;
  amountCents: number;
  expiresAtLabel: string;
  iban: string;
  bic: string;
  accountHolder: string;
  bankName?: string;
  transferLabel: string;
  building: BookingConfirmationBuildingAccess;
  siteUrl?: string;
}

/** J+0 bank transfer instructions — RIB + exact transfer label. */
export function renderBankTransferInstructionsEmail(input: BankTransferInstructionsEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl(input.siteUrl);
  const bankNameLine = input.bankName
    ? `<tr><td style="padding:6px 0;color:#666;">Banque</td><td style="padding:6px 0;">${escapeHtml(input.bankName)}</td></tr>`
    : "";
  const body = `
    <p style="margin-top:0;">Votre réservation est <strong>enregistrée</strong> et en attente de paiement par virement.</p>
    <p><strong>Référence :</strong> ${escapeHtml(input.reservationReference)}<br>
    <strong>Facture proforma :</strong> ${escapeHtml(input.invoiceReference)}</p>
    <p><strong>${escapeHtml(input.spaceName)}</strong><br>
    Du ${escapeHtml(input.startAt)} au ${escapeHtml(input.endAt)}</p>
    <p style="margin:20px 0 8px;"><strong>Montant exact à virer</strong></p>
    <p style="font-size:22px;color:${BRAND_COPPER};margin:0 0 16px;"><strong>${formatEuro(input.amountCents)}</strong></p>
    <p><strong>Libellé exact du virement</strong> (à recopier tel quel) :</p>
    <p style="font-family:ui-monospace,monospace;font-size:18px;background:#f6f3ef;padding:12px 14px;border-radius:6px;">
      <strong>${escapeHtml(input.transferLabel)}</strong>
    </p>
    <p style="margin-top:20px;"><strong>Coordonnées bancaires (RIB)</strong></p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
      <tr><td style="padding:6px 0;color:#666;width:38%;">Titulaire</td><td style="padding:6px 0;">${escapeHtml(input.accountHolder)}</td></tr>
      ${bankNameLine}
      <tr><td style="padding:6px 0;color:#666;">IBAN</td><td style="padding:6px 0;font-family:ui-monospace,monospace;">${escapeHtml(input.iban)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">BIC</td><td style="padding:6px 0;font-family:ui-monospace,monospace;">${escapeHtml(input.bic)}</td></tr>
    </table>
    <p>Merci d'effectuer le virement avant le <strong>${escapeHtml(input.expiresAtLabel)}</strong>.
    Passé ce délai, la réservation pourra être annulée automatiquement.</p>
    ${renderAccessPlanHtml(input.building, siteUrl, { includeSensitiveAccess: false })}
  `;
  return {
    subject: `Virement à effectuer — ${input.reservationReference} — Cowork Prysme`,
    html: layout("Instructions de virement", body, siteUrl),
  };
}

export function renderBankTransferReminderEmail(
  input: BankTransferInstructionsEmailInput & { tier: "j2" | "j4" | "j6" },
): { subject: string; html: string } {
  const siteUrl = resolvePublicSiteUrl(input.siteUrl);
  const tone =
    input.tier === "j2"
      ? "Nous n'avons pas encore reçu votre virement. Voici un rappel des coordonnées."
      : input.tier === "j4"
        ? "Votre règlement par virement est toujours en attente. Merci de procéder rapidement."
        : "Dernière relance : sans paiement sous 48h, votre réservation sera annulée automatiquement.";
  const subjectPrefix =
    input.tier === "j6" ? "Dernière relance" : input.tier === "j4" ? "Relance" : "Rappel";
  const body = `
    <p style="margin-top:0;">${tone}</p>
    <p><strong>Référence :</strong> ${escapeHtml(input.reservationReference)} —
    Montant <strong>${formatEuro(input.amountCents)}</strong> —
    Libellé <strong>${escapeHtml(input.transferLabel)}</strong></p>
    <p>IBAN ${escapeHtml(input.iban)} — BIC ${escapeHtml(input.bic)} — ${escapeHtml(input.accountHolder)}</p>
    <p>Échéance : <strong>${escapeHtml(input.expiresAtLabel)}</strong></p>
  `;
  return {
    subject: `${subjectPrefix} virement ${input.reservationReference} — Cowork Prysme`,
    html: layout("Relance virement", body, siteUrl),
  };
}

export function renderBankTransferExpiredEmail(input: {
  reservationReference: string;
  spaceName: string;
  siteUrl?: string;
}): { subject: string; html: string } {
  const siteUrl = resolvePublicSiteUrl(input.siteUrl);
  const body = `
    <p style="margin-top:0;">Le délai de paiement par virement pour la réservation
    <strong>${escapeHtml(input.reservationReference)}</strong> (${escapeHtml(input.spaceName)})
    est dépassé. La réservation a été <strong>annulée</strong> et le créneau libéré.</p>
    <p>Vous pouvez effectuer une nouvelle recherche sur
    <a href="${escapeHtml(siteUrl)}/reservation" style="color:${BRAND_COPPER};">notre site</a>.</p>
  `;
  return {
    subject: `Réservation annulée — ${input.reservationReference} — Cowork Prysme`,
    html: layout("Réservation annulée", body, siteUrl),
  };
}
