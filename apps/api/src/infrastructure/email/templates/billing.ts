import { fmtDate, fmtDateMaybeTime, fmtMoney } from '../../format';
import { build, detailBox, esc, escMultiline, greeting, p, signOff, type RenderedEmail, type TemplateContext } from './layout';

export interface InvoiceMailData {
  customerName: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  dueDate: Date;
  /** The PDF contains the Swiss QR payment slip. */
  withQrBill?: boolean;
}

/** First invoice for a rental. */
export function invoice(data: InvoiceMailData, ctx: TemplateContext): RenderedEmail {
  const body = [
    greeting(data.customerName),
    p(`Anbei erhalten Sie Ihre Rechnung <strong>${esc(data.invoiceNumber)}</strong> als PDF.`),
    detailBox([
      ['Rechnung', data.invoiceNumber],
      ['Betrag', fmtMoney(data.total, data.currency)],
      ['Zahlbar bis', fmtDate(data.dueDate)],
    ]),
    data.withQrBill
      ? p('Die Rechnung enthält den Einzahlungsschein mit QR-Code. Sie können ihn direkt in Ihrer E-Banking-App scannen.')
      : '',
    signOff(),
  ].join('\n');
  return build(ctx, `Ihre Rechnung ${data.invoiceNumber} – HoppDrive`, {
    preheader: `Rechnung ${data.invoiceNumber}, ${fmtMoney(data.total, data.currency)}`,
    body,
  });
}

export interface DunningData {
  customerName: string;
  invoiceNumber: string;
  originalInvoiceNumber: string;
  dueDate: Date;
  total?: number;
  currency?: string;
  /** Free text from the admin; shown below the standard reminder text. */
  note?: string;
}

/** Payment reminder (Mahnung) with the reissued invoice. */
export function dunning(data: DunningData, ctx: TemplateContext): RenderedEmail {
  const body = [
    greeting(data.customerName),
    p(`Zu unserer Rechnung <strong>${esc(data.originalInvoiceNumber)}</strong> konnten wir bisher keinen Zahlungseingang feststellen.`),
    p(`Anbei erhalten Sie die aktualisierte Rechnung <strong>${esc(data.invoiceNumber)}</strong> als PDF. Bitte begleichen Sie den offenen Betrag bis spätestens <strong>${esc(fmtDate(data.dueDate))}</strong>.`),
    data.total !== undefined && data.currency
      ? detailBox([
          ['Rechnung', data.invoiceNumber],
          ['Offener Betrag', fmtMoney(data.total, data.currency)],
          ['Zahlbar bis', fmtDate(data.dueDate)],
        ])
      : '',
    data.note ? p(escMultiline(data.note)) : '',
    p('Falls Sie die Zahlung in der Zwischenzeit veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.'),
    signOff(),
  ].join('\n');
  return build(ctx, `Zahlungserinnerung zur Rechnung ${data.originalInvoiceNumber} – HoppDrive`, {
    preheader: `Offener Betrag, zahlbar bis ${fmtDate(data.dueDate)}`,
    body,
  });
}

export interface DamageInvoiceData {
  customerName: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  dueDate: Date;
  vehicleName?: string | null;
  bookingRef?: string | null;
  /** Short lines describing the damages, e.g. "Kratzer, vorne links (mittel)". */
  damageLines?: string[];
  withQrBill?: boolean;
}

/** Invoice for damages found at the return of a rental. */
export function damageInvoice(data: DamageInvoiceData, ctx: TemplateContext): RenderedEmail {
  const lines = (data.damageLines ?? []).filter(Boolean);
  const list = lines.length
    ? `<ul style="margin:0 0 16px;padding-left:20px">${lines.map((l) => `<li style="margin:0 0 4px">${esc(l)}</li>`).join('')}</ul>`
    : '';
  const vehicle = data.vehicleName ? ` des Fahrzeugs <strong>${esc(data.vehicleName)}</strong>` : ' des Fahrzeugs';
  const body = [
    greeting(data.customerName),
    p(`bei der Rückgabe${vehicle} wurden Schäden festgestellt, die wir Ihnen mit der beigefügten Rechnung <strong>${esc(data.invoiceNumber)}</strong> in Rechnung stellen.`),
    list,
    detailBox([
      ['Rechnung', data.invoiceNumber],
      ['Buchung', data.bookingRef],
      ['Betrag', fmtMoney(data.total, data.currency)],
      ['Zahlbar bis', fmtDate(data.dueDate)],
    ]),
    data.withQrBill ? p('Die Rechnung enthält den Einzahlungsschein mit QR-Code.') : '',
    p('Das Übergabeprotokoll mit Fotos finden Sie im Anhang, sofern vorhanden. Bei Fragen melden Sie sich gerne bei uns.'),
    signOff(),
  ].join('\n');
  return build(ctx, `Rechnung ${data.invoiceNumber} – Fahrzeugschäden`, {
    preheader: `Rechnung ${data.invoiceNumber} für festgestellte Schäden`,
    body,
  });
}

export interface FineInvoiceData {
  customerName: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  dueDate: Date;
  licensePlate: string;
  occurredAt: Date;
  place?: string | null;
  authority?: string | null;
  reference?: string | null;
  withQrBill?: boolean;
}

/** Invoice for a fine incl. the administrative fee. */
export function fineInvoice(data: FineInvoiceData, ctx: TemplateContext): RenderedEmail {
  const body = [
    greeting(data.customerName),
    p(`für die Busse, die während Ihrer Mietdauer mit dem Fahrzeug <strong>${esc(data.licensePlate)}</strong> ausgestellt wurde, erhalten Sie die Rechnung <strong>${esc(data.invoiceNumber)}</strong>.`),
    detailBox([
      ['Zeitpunkt', fmtDateMaybeTime(data.occurredAt)],
      ['Ort', data.place],
      ['Behörde', data.authority],
      ['Referenz', data.reference],
      ['Rechnungsbetrag', fmtMoney(data.total, data.currency)],
      ['Zahlbar bis', fmtDate(data.dueDate)],
    ]),
    data.withQrBill ? p('Die Rechnung enthält den Einzahlungsschein mit QR-Code.') : '',
    signOff(),
  ].join('\n');
  return build(ctx, `Rechnung ${data.invoiceNumber} – Busse`, {
    preheader: `Rechnung zur Busse vom ${fmtDate(data.occurredAt)}`,
    body,
  });
}
