/**
 * Plain HTML transactional emails for Planning Wave 2 "Gérer" actions
 * (space change / cancellation). No secrets, no attachments here.
 */
import {
  emailDetailRow,
  escapeEmailHtml,
  formatEmailEuro,
  renderCoworkEmailLayout,
  resolvePublicSiteUrl,
} from "@coworkprysme/shared";

export interface SpaceChangeEmailInput {
  reservationReference: string;
  previousSpaceName: string;
  nextSpaceName: string;
  startAt: string;
  endAt: string;
  previousTotalTTC: number;
  nextTotalTTC: number;
  deltaTTC: number;
  billedDifference: boolean;
}

export function renderSpaceChangeEmail(input: SpaceChangeEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl();
  const deltaLabel =
    input.deltaTTC === 0
      ? "Le montant de votre réservation reste inchangé."
      : input.deltaTTC > 0
        ? `Le nouveau montant est supérieur de ${formatEmailEuro(input.deltaTTC)}.`
        : `Le nouveau montant est inférieur de ${formatEmailEuro(Math.abs(input.deltaTTC))}.`;
  const billingNote =
    input.deltaTTC === 0
      ? ""
      : input.billedDifference
        ? '<p style="margin:8px 0 0;">Cette différence sera prise en compte sur votre facture proforma.</p>'
        : '<p style="margin:8px 0 0;">Cette différence ne sera pas facturée pour ce changement.</p>';

  const body = `
    <p style="margin-top:0;">Le salon d'espace de votre réservation a été mis à jour par notre équipe.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      ${emailDetailRow("Référence", `<strong>${escapeEmailHtml(input.reservationReference)}</strong>`)}
      ${emailDetailRow("Ancien espace", escapeEmailHtml(input.previousSpaceName))}
      ${emailDetailRow("Nouvel espace", `<strong>${escapeEmailHtml(input.nextSpaceName)}</strong>`)}
      ${emailDetailRow("Créneau", `Du ${escapeEmailHtml(input.startAt)} au ${escapeEmailHtml(input.endAt)}`)}
      ${emailDetailRow(
        "Nouveau montant TTC",
        `<strong>${formatEmailEuro(input.nextTotalTTC)}</strong>`,
        { last: true },
      )}
    </table>
    <p style="margin:12px 0 0;">${deltaLabel}</p>
    ${billingNote}
    <p style="margin:24px 0 0;">Pour toute question, notre équipe reste à votre disposition.</p>
  `;

  return {
    subject: `Modification de votre réservation ${input.reservationReference} — Cowork Prysme`,
    html: renderCoworkEmailLayout("Modification de réservation", body, siteUrl),
  };
}

export interface CancellationEmailInput {
  reservationReference: string;
  spaceName: string;
  startAt: string;
  endAt: string;
  paidTotalCents: number;
  suggestedRefundCents: number;
}

export function renderCancellationEmail(input: CancellationEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl();
  const refundHtml =
    input.suggestedRefundCents > 0
      ? `<p style="margin:16px 0;padding:10px 14px;background:#f6f3ef;border-radius:6px;border-left:4px solid #B87333;">
          Un remboursement de <strong>${formatEmailEuro(input.suggestedRefundCents)}</strong> vous sera proposé par notre équipe.
        </p>`
      : "";

  const body = `
    <p style="margin-top:0;">Votre réservation a été <strong>annulée</strong> par notre équipe.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      ${emailDetailRow("Référence", `<strong>${escapeEmailHtml(input.reservationReference)}</strong>`)}
      ${emailDetailRow("Espace", escapeEmailHtml(input.spaceName))}
      ${emailDetailRow("Créneau", `Du ${escapeEmailHtml(input.startAt)} au ${escapeEmailHtml(input.endAt)}`)}
      ${emailDetailRow("Montant réglé", formatEmailEuro(input.paidTotalCents), { last: true })}
    </table>
    ${refundHtml}
    <p style="margin:24px 0 0;">Pour toute question, notre équipe reste à votre disposition.</p>
  `;

  return {
    subject: `Annulation de votre réservation ${input.reservationReference} — Cowork Prysme`,
    html: renderCoworkEmailLayout("Réservation annulée", body, siteUrl),
  };
}
