import { fmtDateMaybeTime, fmtMoney } from '../../format';
import { build, detailBox, esc, escMultiline, greeting, p, signOff, type RenderedEmail, type TemplateContext } from './layout';

export interface FineNoticeData {
  customerName: string;
  licensePlate: string;
  occurredAt: Date;
  place?: string | null;
  authority?: string | null;
  reference?: string | null;
  amount: number;
  currency: string;
  /** Free text from the admin (e.g. "Ihre Fahrerdaten wurden an die Behörde übermittelt"). */
  note?: string | null;
}

/** Notice to the renter: a fine arrived for their rental period. */
export function fineNotice(data: FineNoticeData, ctx: TemplateContext): RenderedEmail {
  const body = [
    greeting(data.customerName),
    p(`für das Fahrzeug <strong>${esc(data.licensePlate)}</strong> ist während Ihrer Mietdauer eine Busse bei uns eingegangen. Die Details finden Sie unten; eine Kopie der Verfügung liegt, sofern vorhanden, im Anhang.`),
    detailBox([
      ['Zeitpunkt', fmtDateMaybeTime(data.occurredAt)],
      ['Ort', data.place],
      ['Behörde', data.authority],
      ['Referenz', data.reference],
      ['Bussenbetrag', fmtMoney(data.amount, data.currency)],
    ]),
    data.note ? p(escMultiline(data.note)) : '',
    p('Gemäss Mietvertrag sind Sie für Bussen während der Mietdauer verantwortlich. Wir melden uns bei Ihnen wegen der weiteren Abwicklung.'),
    signOff(),
  ].join('\n');
  return build(ctx, `Mitteilung zu einer Busse – ${data.licensePlate}`, {
    preheader: `Busse vom ${fmtDateMaybeTime(data.occurredAt)}`,
    body,
  });
}
