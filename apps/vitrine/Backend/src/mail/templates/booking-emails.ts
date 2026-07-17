import {
  EMAIL_BRAND_COPPER,
  escapeEmailHtml,
  formatEmailEuro,
  renderCoworkEmailLayout,
  renderFullAccessPlanSection,
  renderPaymentConfirmedEmail,
  resolvePublicSiteUrl,
} from "@coworkprysme/shared";

const BRAND_COPPER = EMAIL_BRAND_COPPER;

function escapeHtml(value: string): string {
  return escapeEmailHtml(value);
}

function formatEuro(cents: number): string {
  return formatEmailEuro(cents);
}

function layout(
  title: string,
  bodyHtml: string,
  siteUrl: string,
  options?: { staffNotification?: boolean },
): string {
  return renderCoworkEmailLayout(title, bodyHtml, siteUrl, options);
}

export { resolvePublicSiteUrl };

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
  if (options.includeSensitiveAccess) {
    return renderFullAccessPlanSection(building, siteUrl);
  }

  // Pre-payment: public address only — never codes, concierge URL, or detailed access instructions.
  return `
    <p><strong>${escapeHtml(building.name)}</strong></p>
    <ul style="padding-left:20px;margin:8px 0 16px;">
      <li><strong>Adresse :</strong> ${escapeHtml(building.addressFull)}</li>
    </ul>
    <p>Les instructions d'accès détaillées (code conciergerie, etc.) vous seront envoyées
    <strong>après réception de votre paiement</strong>.</p>
  `;
}

/** Post-payment client confirmation (card) — same chrome as bank-transfer confirmation. */
export function renderBookingConfirmationEmail(input: BookingConfirmationEmailInput): {
  subject: string;
  html: string;
} {
  return renderPaymentConfirmedEmail({
    reservationReference: input.reservationReference,
    invoiceReference: input.invoiceReference,
    spaceName: input.spaceName,
    startAt: input.startAt,
    endAt: input.endAt,
    totalTTC: input.totalTTC,
    paymentMethod: "card",
    building: input.building,
    siteUrl: input.siteUrl,
    lines: input.lines,
    vatBreakdown: input.vatBreakdown,
  });
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
  paymentMethod: "card" | "bank_transfer";
  siteUrl?: string;
}

/** Internal staff notification — distinct tone from client confirmation. */
export function renderStaffBookingNotificationEmail(input: StaffBookingNotificationEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl(input.siteUrl);
  const paymentLabel = input.paymentMethod === "card" ? "Paiement par carte" : "Virement bancaire";
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
