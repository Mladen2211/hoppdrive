/**
 * Local preview of a discount campaign mail for the admin. The campaign preview endpoint returns counts
 * and a sample code but no HTML, so this mirrors the layout of the API's `discountCampaign` template
 * (infrastructure/email/templates/marketing.ts) in a simplified form. It is shown in a sandboxed
 * iframe (srcDoc) and every interpolated value is escaped. The e-mail itself is always German.
 */
const BRAND = '#A60E0E';
const INK = '#3E4144';
const GRAY = '#5F6265';
const LINE = '#DADADA';
const PAPER = '#F2F2F2';

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Escaped text; blank lines separate paragraphs, single line breaks stay line breaks. */
function paragraphs(text: string): string {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 16px">${esc(block).replace(/\r?\n/g, '<br>')}</p>`)
    .join('\n');
}

export interface CampaignPreviewInput {
  subject: string;
  message: string;
  recipientName?: string | null;
  code?: string | null;
  discountText?: string | null;
  /** Already formatted, e.g. "31.01.2027" */
  validUntil?: string | null;
  companyName?: string;
}

export function renderCampaignPreview(input: CampaignPreviewInput): string {
  const name = (input.recipientName ?? '').trim();
  const codeBox = input.code
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:4px 0 20px;background:#FBEBEB;border:1px dashed ${BRAND};border-radius:10px"><tr><td align="center" style="padding:16px 12px">
        ${input.discountText ? `<div style="font-size:14px;color:${GRAY};margin:0 0 4px">Ihr Vorteil: <strong style="color:${INK}">${esc(input.discountText)}</strong></div>` : ''}
        <div style="font-size:26px;line-height:32px;letter-spacing:2px;font-weight:700;color:${BRAND};font-family:'Courier New',monospace">${esc(input.code)}</div>
        ${input.validUntil ? `<div style="font-size:13px;color:${GRAY};margin:6px 0 0">Gültig bis ${esc(input.validUntil)}</div>` : ''}
      </td></tr></table>`
    : '';
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(input.subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK}">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${PAPER}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px">
    <tr><td style="padding:0 4px 18px;font-size:22px;font-weight:700;color:${BRAND}">HoppDrive</td></tr>
    <tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:14px;padding:28px 28px 24px;font-size:16px;line-height:24px;color:${INK}">
      <p style="margin:0 0 16px">${name ? `Guten Tag ${esc(name)},` : 'Guten Tag,'}</p>
      ${paragraphs(input.message)}
      ${codeBox}
      ${input.code ? `<p style="margin:0 0 16px">Geben Sie den Code einfach im Anfrageformular auf unserer Website ein.</p>` : ''}
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 20px"><tr><td align="center" bgcolor="${BRAND}" style="border-radius:8px"><span style="display:inline-block;padding:13px 26px;font-size:16px;font-weight:600;line-height:20px;color:#ffffff;border-radius:8px">Jetzt Fahrzeug anfragen</span></td></tr></table>
      <p style="margin:24px 0 0">Freundliche Grüsse<br>Ihr HoppDrive Team</p>
    </td></tr>
    <tr><td style="padding:18px 8px 0;font-size:12px;line-height:18px;color:${GRAY}">
      ${esc(input.companyName || 'HoppDrive')}
      <p style="margin:12px 0 0;font-size:12px;line-height:18px;color:${GRAY}">Sie erhalten diese E-Mail, weil Sie bei HoppDrive Kunde sind oder Angebote erhalten möchten. <span style="text-decoration:underline">Hier abmelden</span>.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
