import { ROLE_LABELS, type AdminRole } from '@hoppdrive/shared';
import { build, button, esc, fallbackLink, greeting, p, signOff, type RenderedEmail, type TemplateContext } from './layout';

export interface AdminInviteData {
  inviteUrl: string;
  /** Display name of the admin who sent the invite. */
  invitedBy: string;
  role: AdminRole;
}

/** Invitation to join the admin area. */
export function adminInvite(data: AdminInviteData, ctx: TemplateContext): RenderedEmail {
  const body = [
    greeting(),
    p(`<strong>${esc(data.invitedBy)}</strong> hat Sie zum HoppDrive Verwaltungsbereich eingeladen. Ihre Rolle: <strong>${esc(ROLE_LABELS[data.role] ?? data.role)}</strong>.`),
    p('Mit diesem Link legen Sie Ihren Namen und Ihr Passwort fest:'),
    button('Einladung annehmen', data.inviteUrl),
    fallbackLink(data.inviteUrl),
    p('Der Link ist 7 Tage gültig. Wenn Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.'),
    signOff(),
  ].join('\n');
  return build(ctx, 'Einladung zum HoppDrive Verwaltungsbereich', {
    preheader: `${data.invitedBy} hat Sie zu HoppDrive eingeladen.`,
    body,
  });
}

export interface AdminInviteAcceptedData {
  name: string;
  /** Link to the admin app login. */
  loginUrl: string;
  role: AdminRole;
}

/** Sent to the new user after the invite was accepted: confirms the account is active. */
export function adminInviteAccepted(data: AdminInviteAcceptedData, ctx: TemplateContext): RenderedEmail {
  const body = [
    greeting(data.name),
    p(`Ihr Zugang zum HoppDrive Verwaltungsbereich ist jetzt aktiv. Ihre Rolle: <strong>${esc(ROLE_LABELS[data.role] ?? data.role)}</strong>.`),
    button('Zur Anmeldung', data.loginUrl),
    p('Haben Sie die Einladung nicht selbst angenommen? Bitte melden Sie sich umgehend bei Ihrem Administrator.'),
    signOff(),
  ].join('\n');
  return build(ctx, 'Ihr HoppDrive Zugang ist aktiv', { preheader: 'Willkommen im HoppDrive Verwaltungsbereich.', body });
}

export interface PasswordResetData {
  resetUrl: string;
  expiresInMinutes: number;
}

/** Password reset link. */
export function passwordReset(data: PasswordResetData, ctx: TemplateContext): RenderedEmail {
  const body = [
    greeting(),
    p('Für Ihren HoppDrive Zugang wurde ein neues Passwort angefordert. Mit diesem Link legen Sie es fest:'),
    button('Neues Passwort festlegen', data.resetUrl),
    fallbackLink(data.resetUrl),
    p(`Der Link ist ${esc(data.expiresInMinutes)} Minuten gültig und kann nur einmal verwendet werden.`),
    p('Wenn Sie kein neues Passwort angefordert haben, können Sie diese E-Mail ignorieren. Ihr bisheriges Passwort bleibt gültig.'),
    signOff(),
  ].join('\n');
  return build(ctx, 'Passwort zurücksetzen – HoppDrive', { preheader: 'Link zum Festlegen eines neuen Passworts.', body });
}
