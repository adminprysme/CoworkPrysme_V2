import {
  emailDetailRow,
  escapeEmailHtml,
  renderCoworkEmailLayout,
  resolvePublicSiteUrl,
} from "@coworkprysme/shared";

export function renderInviteAcceptedEmail(input: { companyLabel: string }): {
  subject: string;
  html: string;
} {
  const siteUrl = resolvePublicSiteUrl();
  const company = escapeEmailHtml(input.companyLabel);
  const body = `
    <p style="margin-top:0;">Votre compte collaborateur est créé et rattaché à <strong>${company}</strong>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
      ${emailDetailRow("Société / dossier", `<strong>${company}</strong>`, { last: true })}
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#555;">
      Vous pouvez vous connecter à l'espace client Cowork Prysme avec l'email de l'invitation
      et le mot de passe que vous venez de choisir.
    </p>
  `;

  return {
    subject: `Compte créé — ${input.companyLabel} sur Cowork Prysme`,
    html: renderCoworkEmailLayout("Compte collaborateur créé", body, siteUrl),
  };
}
