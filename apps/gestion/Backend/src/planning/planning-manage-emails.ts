/**
 * Plain HTML transactional emails for Planning Wave 2 "Gérer" actions
 * (space change / cancellation / restore). No secrets, no attachments here.
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
   * contain any monetary figure — neither « Montant réglé » nor a refund line.
   */
  refundCents: number;
}

export function renderCancellationEmail(input: CancellationEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl();
  const showRefund = input.refundCents > 0;

  const paidRow = showRefund
    ? emailDetailRow("Montant réglé", formatEmailEuro(input.paidTotalCents), { last: true })
    : "";

  const refundHtml = showRefund
    ? `<p style="margin:16px 0;padding:10px 14px;background:#f6f3ef;border-radius:6px;border-left:4px solid #B87333;">
          Un remboursement de <strong>${formatEmailEuro(input.refundCents)}</strong> vous sera proposé par notre équipe.
        </p>`
    : "";

  const body = `
    <p style="margin-top:0;">Votre réservation a été <strong>annulée</strong> par notre équipe.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      ${emailDetailRow("Référence", `<strong>${escapeEmailHtml(input.reservationReference)}</strong>`)}
      ${emailDetailRow("Espace", escapeEmailHtml(input.spaceName))}
      ${emailDetailRow(
        "Créneau",
        `Du ${escapeEmailHtml(input.startAt)} au ${escapeEmailHtml(input.endAt)}`,
        { last: !showRefund },
      )}
      ${paidRow}
    </table>
    ${refundHtml}
    <p style="margin:24px 0 0;">Pour toute question, notre équipe reste à votre disposition.</p>
  `;

  return {
    subject: `Annulation de votre réservation ${input.reservationReference} — Cowork Prysme`,
    html: renderCoworkEmailLayout("Réservation annulée", body, siteUrl),
  };
}

export interface RestoreEmailInput {
  reservationReference: string;
  spaceName: string;
  startAt: string;
  endAt: string;
}

export function renderRestoreEmail(input: RestoreEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl();
  const body = `
    <p style="margin-top:0;">Votre réservation a été <strong>restaurée</strong> par notre équipe. Elle est à nouveau confirmée sur le créneau ci-dessous.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      ${emailDetailRow("Référence", `<strong>${escapeEmailHtml(input.reservationReference)}</strong>`)}
      ${emailDetailRow("Espace", escapeEmailHtml(input.spaceName))}
      ${emailDetailRow(
        "Créneau",
        `Du ${escapeEmailHtml(input.startAt)} au ${escapeEmailHtml(input.endAt)}`,
        { last: true },
      )}
    </table>
    <p style="margin:24px 0 0;">Pour toute question, notre équipe reste à votre disposition.</p>
  `;

  return {
    subject: `Restauration de votre réservation ${input.reservationReference} — Cowork Prysme`,
    html: renderCoworkEmailLayout("Réservation restaurée", body, siteUrl),
  };
}

export interface DateChangeEmailInput {
  reservationReference: string;
  kind: "extend" | "shorten" | "shift";
  previousStartAt: string;
  previousEndAt: string;
  nextStartAt: string;
  nextEndAt: string;
  /** Positive complement TTC in centimes actually billed (0 when not billed). */
  complementTTC: number;
  /** When false, the email must not mention any amount. */
  billedDifference: boolean;
}

const DATE_CHANGE_KIND_LABELS: Record<DateChangeEmailInput["kind"], string> = {
  extend: "agrandie",
  shorten: "raccourcie",
  shift: "reportée",
};

export function renderDateChangeEmail(input: DateChangeEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl();
  const showAmount = input.billedDifference && input.complementTTC > 0;
  const kindLabel = DATE_CHANGE_KIND_LABELS[input.kind];

  const amountRow = showAmount
    ? emailDetailRow(
        "Complément facturé TTC",
        `<strong>${formatEmailEuro(input.complementTTC)}</strong>`,
        { last: true },
      )
    : "";

  const billingNote = showAmount
    ? `<p style="margin:12px 0 0;">Un complément de <strong>${formatEmailEuro(input.complementTTC)}</strong> a été ajouté à votre facture proforma.</p>`
    : "";

  const body = `
    <p style="margin-top:0;">Votre réservation a été <strong>${kindLabel}</strong> par notre équipe.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      ${emailDetailRow("Référence", `<strong>${escapeEmailHtml(input.reservationReference)}</strong>`)}
      ${emailDetailRow(
        "Ancien créneau",
        `Du ${escapeEmailHtml(input.previousStartAt)} au ${escapeEmailHtml(input.previousEndAt)}`,
      )}
      ${emailDetailRow(
        "Nouveau créneau",
        `<strong>Du ${escapeEmailHtml(input.nextStartAt)} au ${escapeEmailHtml(input.nextEndAt)}</strong>`,
        { last: !showAmount },
      )}
      ${amountRow}
    </table>
    ${billingNote}
    <p style="margin:24px 0 0;">Pour toute question, notre équipe reste à votre disposition.</p>
  `;

  return {
    subject: `Modification des dates de votre réservation ${input.reservationReference} — Cowork Prysme`,
    html: renderCoworkEmailLayout("Dates de réservation modifiées", body, siteUrl),
  };
}

export interface PartySizeEmailInput {
  reservationReference: string;
  spaceName: string;
  startAt: string;
  endAt: string;
  previousPartySize: number;
  newPartySize: number;
}

export function renderPartySizeEmail(input: PartySizeEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl();
  const body = `
    <p style="margin-top:0;">Le nombre de personnes prévu pour votre réservation a été mis à jour par notre équipe.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      ${emailDetailRow("Référence", `<strong>${escapeEmailHtml(input.reservationReference)}</strong>`)}
      ${emailDetailRow("Espace", escapeEmailHtml(input.spaceName))}
      ${emailDetailRow(
        "Créneau",
        `Du ${escapeEmailHtml(input.startAt)} au ${escapeEmailHtml(input.endAt)}`,
      )}
      ${emailDetailRow(
        "Nombre de personnes",
        `<strong>${input.previousPartySize} → ${input.newPartySize}</strong>`,
        { last: true },
      )}
    </table>
    <p style="margin:24px 0 0;">Pour toute question, notre équipe reste à votre disposition.</p>
  `;

  return {
    subject: `Effectif mis à jour pour votre réservation ${input.reservationReference} — Cowork Prysme`,
    html: renderCoworkEmailLayout("Nombre de personnes mis à jour", body, siteUrl),
  };
}

export interface ContactTransferEmailInput {
  reservationReference: string;
  spaceName: string;
  startAt: string;
  endAt: string;
  previousContactLabel: string;
  nextContactLabel: string;
  /** Which recipient this render targets — copy is tailored accordingly. */
  audience: "previous" | "next";
}

export function renderContactTransferEmail(input: ContactTransferEmailInput): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl();
  const intro =
    input.audience === "previous"
      ? `<p style="margin-top:0;">Le contact principal de cette réservation a été transféré à <strong>${escapeEmailHtml(input.nextContactLabel)}</strong> par notre équipe. Vous ne recevrez plus les communications liées à cette réservation.</p>`
      : `<p style="margin-top:0;">Vous êtes désormais le <strong>contact principal</strong> de la réservation ci-dessous, transférée par notre équipe.</p>`;

  const body = `
    ${intro}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      ${emailDetailRow("Référence", `<strong>${escapeEmailHtml(input.reservationReference)}</strong>`)}
      ${emailDetailRow("Espace", escapeEmailHtml(input.spaceName))}
      ${emailDetailRow(
        "Créneau",
        `Du ${escapeEmailHtml(input.startAt)} au ${escapeEmailHtml(input.endAt)}`,
      )}
      ${emailDetailRow("Ancien contact", escapeEmailHtml(input.previousContactLabel))}
      ${emailDetailRow("Nouveau contact", `<strong>${escapeEmailHtml(input.nextContactLabel)}</strong>`, { last: true })}
    </table>
    <p style="margin:24px 0 0;">Pour toute question, notre équipe reste à votre disposition.</p>
  `;

  return {
    subject: `Transfert de contact — réservation ${input.reservationReference} — Cowork Prysme`,
    html: renderCoworkEmailLayout("Transfert de contact", body, siteUrl),
  };
}
