import { fmtDate } from '../../format';
import { build, button, esc, escMultiline, greeting, p, signOff, type RenderedEmail, type TemplateContext } from './layout';

export interface DiscountCampaignData {
  recipientName?: string | null;
  subject: string;
  /** Plain text typed by the admin; line breaks are kept. */
  message: string;
  /** The discount code for this recipient (shared or personal). */
  code?: string | null;
  /** "20 %" or "CHF 30.00" */
  discountText?: string | null;
  validUntil?: Date | null;
  /** Link to the rental pages. */
  bookUrl?: string | null;
  unsubscribeUrl: string;
}

/** Discount / marketing mail. Always carries the unsubscribe link. */
export function discountCampaign(data: DiscountCampaignData, ctx: TemplateContext): RenderedEmail {
  const codeBox = data.code
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:4px 0 20px;background:#FBEBEB;border:1px dashed #A60E0E;border-radius:10px"><tr><td align="center" style="padding:16px 12px">
        ${data.discountText ? `<div style="font-size:14px;color:#5F6265;margin:0 0 4px">Ihr Vorteil: <strong style="color:#3E4144">${esc(data.discountText)}</strong></div>` : ''}
        <div style="font-size:26px;line-height:32px;letter-spacing:2px;font-weight:700;color:#A60E0E;font-family:'Courier New',monospace">${esc(data.code)}</div>
        ${data.validUntil ? `<div style="font-size:13px;color:#5F6265;margin:6px 0 0">Gültig bis ${esc(fmtDate(data.validUntil))}</div>` : ''}
      </td></tr></table>`
    : '';
  const body = [
    greeting(data.recipientName),
    p(escMultiline(data.message)),
    codeBox,
    data.code ? p('Geben Sie den Code einfach im Anfrageformular auf unserer Website ein.') : '',
    data.bookUrl ? button('Jetzt Fahrzeug anfragen', data.bookUrl) : '',
    signOff(),
  ].join('\n');
  return build(ctx, data.subject, {
    preheader: data.code ? `Ihr persönlicher Code: ${data.code}` : data.subject,
    body,
    unsubscribeUrl: data.unsubscribeUrl,
  });
}

/** Confirmation after unsubscribing (sent once). */
export function unsubscribeConfirmation(_data: Record<string, never>, ctx: TemplateContext): RenderedEmail {
  const body = [
    greeting(),
    p('Sie wurden erfolgreich von unseren Angeboten und Neuigkeiten abgemeldet. Sie erhalten keine Werbe-E-Mails mehr von uns.'),
    p('Wichtige Nachrichten zu bestehenden Buchungen, Verträgen und Rechnungen erhalten Sie weiterhin.'),
    p('Falls dies ein Versehen war, können Sie sich jederzeit über das Anfrageformular auf unserer Website wieder anmelden.'),
    signOff(),
  ].join('\n');
  return build(ctx, 'Abmeldung bestätigt – HoppDrive', { preheader: 'Sie erhalten keine Angebote mehr.', body });
}
