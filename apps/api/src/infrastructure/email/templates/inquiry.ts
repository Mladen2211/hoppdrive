import { fmtDate } from '../../format';
import { build, button, detailBox, esc, escMultiline, greeting, p, signOff, type RenderedEmail, type TemplateContext } from './layout';

export interface InquiryReceivedData {
  customerName: string;
  vehicleOfInterest?: string | null;
  desiredStart?: Date | null;
  desiredEnd?: Date | null;
}

/** Confirmation to the customer that the inquiry arrived. */
export function inquiryReceived(data: InquiryReceivedData, ctx: TemplateContext): RenderedEmail {
  const period =
    data.desiredStart && data.desiredEnd ? `${fmtDate(data.desiredStart)} – ${fmtDate(data.desiredEnd)}` : null;
  const body = [
    greeting(data.customerName),
    p('Vielen Dank für Ihre Anfrage. Wir melden uns innerhalb von 24 Stunden bei Ihnen.'),
    data.vehicleOfInterest || period
      ? detailBox([
          ['Fahrzeug', data.vehicleOfInterest],
          ['Gewünschter Zeitraum', period],
        ])
      : '',
    signOff(),
  ].join('\n');
  return build(ctx, 'Ihre Anfrage ist eingegangen – HoppDrive', {
    preheader: 'Wir melden uns innerhalb von 24 Stunden bei Ihnen.',
    body,
  });
}

export interface AdminNotificationData {
  contactRequestId: string;
  customerName: string;
  message: string;
  /** Link to the inquiry in the admin app (optional). */
  inquiryUrl?: string;
}

/** Internal notification about a new inquiry. */
export function adminNotification(data: AdminNotificationData, ctx: TemplateContext): RenderedEmail {
  const body = [
    p(`Neue Anfrage (<span style="font-family:monospace">${esc(data.contactRequestId)}</span>) von <strong>${esc(data.customerName)}</strong>:`),
    `<blockquote style="margin:0 0 20px;padding:12px 16px;border-left:4px solid #DADADA;background:#F2F2F2;border-radius:0 8px 8px 0">${escMultiline(data.message)}</blockquote>`,
    data.inquiryUrl ? button('Anfrage öffnen', data.inquiryUrl) : '',
  ].join('\n');
  return build(ctx, `Neue Anfrage von ${data.customerName}`, { preheader: `Neue Anfrage von ${data.customerName}`, body });
}

export interface DeclineData {
  customerName: string;
  reason?: string | null;
}

/** Polite decline of an inquiry. */
export function decline(data: DeclineData, ctx: TemplateContext): RenderedEmail {
  const body = [
    greeting(data.customerName),
    p('Leider können wir Ihre Anfrage derzeit nicht bestätigen.'),
    data.reason ? p(escMultiline(data.reason)) : '',
    p('Gerne helfen wir Ihnen bei einer alternativen Buchung weiter.'),
    signOff(),
  ].join('\n');
  return build(ctx, 'Ihre Anfrage bei HoppDrive', { preheader: 'Antwort auf Ihre Anfrage.', body });
}
