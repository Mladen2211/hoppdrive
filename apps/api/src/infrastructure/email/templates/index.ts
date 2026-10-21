import type { RenderedEmail, TemplateContext } from './layout';
import { adminInvite, adminInviteAccepted, passwordReset } from './auth';
import { adminNotification, decline, inquiryReceived } from './inquiry';
import { bookingConfirmation, contract, contractPackage } from './booking';
import { damageInvoice, dunning, fineInvoice, invoice } from './billing';
import { fineNotice } from './fine';
import { discountCampaign, unsubscribeConfirmation } from './marketing';
import { testEmail } from './system';

export * from './layout';
export * from './auth';
export * from './inquiry';
export * from './booking';
export * from './billing';
export * from './fine';
export * from './marketing';
export * from './system';

/**
 * Template registry. The key is stored in EmailMessage.template and shown in the admin e-mail log.
 *
 * `sensitive` templates carry a one-time link: their HTML is wiped from the log as soon as the message
 * is sent (or finally failed), and such messages cannot be re-sent from the log.
 */
export const EMAIL_TEMPLATES = {
  admin_invite: { render: adminInvite, label: 'Einladung (Verwaltung)', sensitive: true },
  admin_invite_accepted: { render: adminInviteAccepted, label: 'Einladung angenommen', sensitive: false },
  password_reset: { render: passwordReset, label: 'Passwort zurücksetzen', sensitive: true },
  inquiry_received: { render: inquiryReceived, label: 'Anfrage eingegangen', sensitive: false },
  admin_notification: { render: adminNotification, label: 'Neue Anfrage (intern)', sensitive: false },
  inquiry_declined: { render: decline, label: 'Anfrage abgelehnt', sensitive: false },
  booking_confirmation: { render: bookingConfirmation, label: 'Buchungsbestätigung', sensitive: false },
  contract: { render: contract, label: 'Mietvertrag', sensitive: false },
  contract_package: { render: contractPackage, label: 'Vertragspaket', sensitive: false },
  invoice: { render: invoice, label: 'Rechnung', sensitive: false },
  dunning: { render: dunning, label: 'Mahnung', sensitive: false },
  damage_invoice: { render: damageInvoice, label: 'Rechnung Schaden', sensitive: false },
  fine_notice: { render: fineNotice, label: 'Bussenmitteilung', sensitive: false },
  fine_invoice: { render: fineInvoice, label: 'Rechnung Busse', sensitive: false },
  discount_campaign: { render: discountCampaign, label: 'Rabatt-Kampagne', sensitive: false },
  unsubscribe_confirmation: { render: unsubscribeConfirmation, label: 'Abmeldung bestätigt', sensitive: false },
  test: { render: testEmail, label: 'Test', sensitive: false },
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;

/** Type of the data a template takes. */
export type EmailTemplateData<K extends EmailTemplateKey> = Parameters<(typeof EMAIL_TEMPLATES)[K]['render']>[0];

export const EMAIL_TEMPLATE_KEYS = Object.keys(EMAIL_TEMPLATES) as EmailTemplateKey[];

export function renderEmailTemplate<K extends EmailTemplateKey>(
  key: K,
  data: EmailTemplateData<K>,
  ctx: TemplateContext,
): RenderedEmail {
  // The registry is a union of renderers; the generic signature above keeps callers type-safe.
  return (EMAIL_TEMPLATES[key].render as (d: unknown, c: TemplateContext) => RenderedEmail)(data, ctx);
}

export function isSensitiveTemplate(key: string): boolean {
  return key in EMAIL_TEMPLATES && EMAIL_TEMPLATES[key as EmailTemplateKey].sensitive;
}
