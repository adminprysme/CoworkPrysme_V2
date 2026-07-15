const BRAND_COPPER = "#B87333";
const BRAND_DARK = "#1a1a1a";

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f6f3ef;font-family:Georgia,'Times New Roman',serif;color:${BRAND_DARK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ef;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8dfd4;border-radius:8px;overflow:hidden;">
        <tr><td style="background:${BRAND_COPPER};padding:20px 28px;">
          <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:normal;">Cowork Prysme</h1>
        </td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px 24px;font-size:12px;color:#666;border-top:1px solid #eee;">
          Cowork Prysme — coworkprysme.eu
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
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
}

export function renderBookingConfirmationEmail(input: BookingConfirmationEmailInput): {
  subject: string;
  html: string;
} {
  const linesHtml = input.lines
    .map(
      (line) =>
        `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #eee;">${line.label}${line.qty > 1 ? ` × ${line.qty}` : ""}</td>
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
    <p><strong>Référence :</strong> ${input.reservationReference}<br>
    <strong>Facture proforma :</strong> ${input.invoiceReference}</p>
    <p><strong>${input.spaceName}</strong><br>
    Du ${input.startAt} au ${input.endAt}</p>
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
    <p><strong>Plan d'accès — Bâtiment A1</strong></p>
    <ol style="padding-left:20px;">
      <li>Entrée principale le long de la grille devant la rue Saint Jean de Dieu — suivre l'allée devant la grille.</li>
      <li>Interphone devant la porte : sonner à <strong>CoworkPrysme</strong>.</li>
    </ol>
    <p>Retrouvez aussi nos instructions détaillées sur <a href="https://coworkprysme.eu/contact" style="color:${BRAND_COPPER};">coworkprysme.eu/contact</a>.</p>
  `;

  return {
    subject: `Confirmation de réservation ${input.reservationReference} — Cowork Prysme`,
    html: layout("Confirmation de réservation", body),
  };
}

export function renderAccountCreatedEmail(input: { email: string }): {
  subject: string;
  html: string;
} {
  const body = `
    <p style="margin-top:0;">Votre compte client Cowork Prysme a été créé avec l'adresse <strong>${input.email}</strong>.</p>
    <p>Vous pourrez bientôt vous connecter à votre espace client pour consulter vos réservations et factures.</p>
    <p>Consultez notre <a href="https://coworkprysme.eu/politique-de-confidentialite" style="color:${BRAND_COPPER};">politique de confidentialité</a>.</p>
  `;

  return {
    subject: "Votre compte Cowork Prysme a été créé",
    html: layout("Compte créé", body),
  };
}
