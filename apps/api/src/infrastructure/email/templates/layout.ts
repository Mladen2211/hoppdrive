import type { CompanyInfo } from '../../services/SettingsService';

/** Escapes text for HTML element content and attribute values. Use it on EVERY interpolated value. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escaped text with line breaks kept (<br>). For free text typed by customers / admins. */
export function escMultiline(value: unknown): string {
  return esc(value).replace(/\r?\n/g, '<br>');
}

/** Only http(s) and mailto links are allowed in href attributes; anything else becomes "#". */
export function safeUrl(url: string): string {
  const trimmed = String(url ?? '').trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? esc(trimmed) : '#';
}

/** Context every template receives (resolved once per message by the EmailService). */
export interface TemplateContext {
  company: CompanyInfo;
  /** Public website, e.g. https://hoppdrive.ch (no trailing slash). */
  siteUrl: string;
  /** Absolute URL of the logo image shown in the header. */
  logoUrl: string;
}

/** Result of a template: the e-mail subject plus the finished HTML document. */
export interface RenderedEmail {
  subject: string;
  html: string;
  /** Plain-text version (links and structure kept simple). */
  text: string;
}

export interface LayoutOptions {
  /** Hidden preview text shown by mail clients next to the subject. */
  preheader?: string;
  /** Body HTML (already escaped by the caller). */
  body: string;
  /** Marketing mails: unsubscribe link shown in the footer (required by law / good practice). */
  unsubscribeUrl?: string;
}

const BRAND = '#A60E0E';
const INK = '#3E4144';
const GRAY = '#5F6265';
const LINE = '#DADADA';
const PAPER = '#F2F2F2';
const FONT = "'Fira Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Greeting line: "Guten Tag Max Muster," or "Guten Tag," when no name is known. */
export function greeting(name?: string | null): string {
  const n = (name ?? '').trim();
  return `<p style="margin:0 0 16px">${n ? `Guten Tag ${esc(n)},` : 'Guten Tag,'}</p>`;
}

/** A paragraph of body text (value must already be escaped / contain trusted markup). */
export function p(html: string): string {
  return `<p style="margin:0 0 16px">${html}</p>`;
}

/** Bulletproof button (table based, works in Outlook). */
export function button(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 20px"><tr><td align="center" bgcolor="${BRAND}" style="border-radius:8px"><a href="${safeUrl(url)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px">${esc(label)}</a></td></tr></table>`;
}

/** The raw link as text below a button, for clients that block buttons. */
export function fallbackLink(url: string): string {
  return `<p style="margin:0 0 16px;font-size:13px;line-height:19px;color:${GRAY}">Falls der Button nicht funktioniert, kopieren Sie diese Adresse in Ihren Browser:<br><a href="${safeUrl(url)}" style="color:${GRAY};word-break:break-all">${esc(url)}</a></p>`;
}

/** Label/value rows in a light box (booking details, invoice summary, fine data). */
export function detailBox(rows: Array<[label: string, value: string | null | undefined]>): string {
  const html = rows
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 14px 6px 0;font-size:14px;line-height:20px;color:${GRAY};vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:6px 0;font-size:14px;line-height:20px;color:${INK};font-weight:600;vertical-align:top">${esc(value)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;background:${PAPER};border-radius:10px"><tr><td style="padding:12px 18px"><table role="presentation" cellspacing="0" cellpadding="0" border="0">${html}</table></td></tr></table>`;
}

/** Closing: "Freundliche Grüsse, Ihr HoppDrive Team". */
export function signOff(): string {
  return `<p style="margin:24px 0 0">Freundliche Grüsse<br>Ihr HoppDrive Team</p>`;
}

/** Wraps the body in the branded layout: header logo, white card, company footer. */
export function renderLayout(ctx: TemplateContext, options: LayoutOptions): string {
  const c = ctx.company;
  const addressLine = [c.name, [c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' · ');
  const contactLine = [c.phone, c.email].filter(Boolean).join(' · ');
  const uidLine = c.uid ? esc(c.uid) : '';
  const unsubscribe = options.unsubscribeUrl
    ? `<p style="margin:12px 0 0;font-size:12px;line-height:18px;color:${GRAY}">Sie erhalten diese E-Mail, weil Sie bei HoppDrive Kunde sind oder Angebote erhalten möchten. <a href="${safeUrl(options.unsubscribeUrl)}" style="color:${GRAY};text-decoration:underline">Hier abmelden</a>.</p>`
    : '';
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${esc(options.preheader)}</div>`
    : '';

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>HoppDrive</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${FONT};color:${INK}">
${preheader}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${PAPER}">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px">
    <tr><td style="padding:0 4px 18px"><a href="${safeUrl(ctx.siteUrl)}" target="_blank"><img src="${safeUrl(ctx.logoUrl)}" alt="HoppDrive" width="170" style="display:block;border:0;outline:none;height:auto;max-width:170px"></a></td></tr>
    <tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:14px;padding:28px 28px 24px;font-size:16px;line-height:24px;color:${INK}">
${options.body}
    </td></tr>
    <tr><td style="padding:18px 8px 0;font-size:12px;line-height:18px;color:${GRAY}">
      ${esc(addressLine)}<br>${esc(contactLine)}${uidLine ? `<br>${uidLine}` : ''}
      ${unsubscribe}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/** Very small HTML-to-text conversion for the text/plain alternative. */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return text && text !== href ? `${text} (${href})` : href;
    })
    .replace(/<\/(p|tr|h\d|table|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Builds the RenderedEmail (html + text) from a subject and layout options. */
export function build(ctx: TemplateContext, subject: string, options: LayoutOptions): RenderedEmail {
  const html = renderLayout(ctx, options);
  return { subject, html, text: htmlToText(html) };
}
