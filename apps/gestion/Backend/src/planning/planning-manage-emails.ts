/**
 * Plain HTML transactional emails for Planning Wave 2 "Gérer" actions
 * (space change / cancellation). No secrets, no attachments here.
 *
 * Amounts are only shown when the staff action actually applies them to the
 * client (billed space-change delta / confirmed refund > 0).
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
  /** When false, the email must not mention any price or delta. */
  billedDifference: boolean;
}

function formatSignedEuroDelta(deltaTTC: number): string {
  const abs = formatEmailEuro(Math.abs(deltaTTC));
  if (deltaTTC > 0) {
    return `+${abs}`;
  }
  if (deltaTTC < 0) {
    return `−${abs}`;
  }
  return abs;
}

export function renderSpaceChangeEmail(input: SpaceChangeEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl();
  const showBilledAmount = input.billedDifference && input.deltaTTC !== 0;

  const amountRows = showBilledAmount
    ? emailDetailRow(
        "Nouveau montant TTC",
        `<strong>${formatEmailEuro(input.nextTotalTTC)}</strong>`,
        { last: true },
      )
    : "";

  const billingNote = showBilledAmount
    ? input.deltaTTC > 0
      ? `<p style="margin:12px 0 0;">Le montant de votre réservation a été ajusté de <strong>${formatSignedEuroDelta(input.deltaTTC)}</strong>, un complément vous sera facturé.</p>`
      : `<p style="margin:12px 0 0;">Le montant de votre réservation a été ajusté de <strong>${formatSignedEuroDelta(input.deltaTTC)}</strong>, cet ajustement sera pris en compte sur votre facture.</p>`
    : "";

  const body = `
    <p style="margin-top:0;">Le salon d'espace de votre réservation a été mis à jour par notre équipe.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      ${emailDetailRow("Référence", `<strong>${escapeEmailHtml(input.reservationReference)}</strong>`)}
      ${emailDetailRow("Ancien espace", escapeEmailHtml(input.previousSpaceName))}
      ${emailDetailRow("Nouvel espace", `<strong>${escapeEmailHtml(input.nextSpaceName)}</strong>`)}
      ${emailDetailRow(
        "Créneau",
        `Du ${escapeEmailHtml(input.startAt)} au ${escapeEmailHtml(input.endAt)}`,
        {
          last: !showBilledAmount,
        },
      )}
      ${amountRows}
    </table>
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
  /**
   * Confirmed refund amount in integer cents.
   * When 0 (e.g. staff chose « Ne pas rembourser »), the email must not
   * mention any refund figure — including an explicit « 0 € ».
   */
  refundCents: number;
}

export function renderCancellationEmail(input: CancellationEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl();
  const refundHtml =
    input.refundCents > 0
      ? `<p style="margin:16px 0;padding:10px 14px;background:#f6f3ef;border-radius:6px;border-left:4px solid #B87333;">
          Un remboursement de <strong>${formatEmailEuro(input.refundCents)}</strong> vous sera proposé par notre équipe.
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
