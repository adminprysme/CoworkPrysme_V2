import {
  emailDetailRow,
  escapeEmailHtml,
  renderCoworkEmailLayout,
  resolvePublicSiteUrl,
} from "@coworkprysme/shared";

export function renderClientInviteEmail(input: {
  companyLabel: string;
  expiresAtLabel: string;
  /** Absolute invite URL — never log this value. */
  inviteUrl: string;
}): { subject: string; html: string } {
  const siteUrl = resolvePublicSiteUrl();
  const company = escapeEmailHtml(input.companyLabel);
  const body = `
    <p style="margin-top:0;">Vous êtes invité(e) à rejoindre l'espace client <strong>${company}</strong> sur Cowork Prysme.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      ${emailDetailRow("Société / dossier", `<strong>${company}</strong>`)}
      ${emailDetailRow("Lien valable jusqu'au", escapeEmailHtml(input.expiresAtLabel), { last: true })}
    </table>
    <p style="margin:20px 0 8px;">
      <a href="${escapeEmailHtml(input.inviteUrl)}"
         style="display:inline-block;padding:12px 20px;background:#1f4b7a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
        Créer mon compte
      </a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#555;">
      Ce lien est personnel et à usage unique. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
    </p>
  `;

  return {
    subject: `Invitation — rejoindre ${input.companyLabel} sur Cowork Prysme`,
    html: renderCoworkEmailLayout("Invitation collaborateur", body, siteUrl),
  };
}
