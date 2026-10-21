import { fmtDateMaybeTime, fmtMoney } from '../../format';
import { build, detailBox, esc, greeting, p, signOff, type RenderedEmail, type TemplateContext } from './layout';

export interface BookingConfirmationData {
  customerName: string;
  vehicleName: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  currency: string;
  /** Discount already deducted from totalPrice. */
  discountAmount?: number;
  bookingRef?: string;
}

/** Reservation confirmation. */
export function bookingConfirmation(data: BookingConfirmationData, ctx: TemplateContext): RenderedEmail {
  const body = [
    greeting(data.customerName),
    p(`Ihre Reservierung für <strong>${esc(data.vehicleName)}</strong> wurde erfasst.`),
    detailBox([
      ['Buchung', data.bookingRef],
      ['Fahrzeug', data.vehicleName],
      ['Übergabe', fmtDateMaybeTime(data.startDate)],
      ['Rückgabe', fmtDateMaybeTime(data.endDate)],
      ['Rabatt', data.discountAmount && data.discountAmount > 0 ? `- ${fmtMoney(data.discountAmount, data.currency)}` : null],
      ['Gesamtpreis', fmtMoney(data.totalPrice, data.currency)],
    ]),
    p('Wir freuen uns auf Sie!'),
    signOff(),
  ].join('\n');
  return build(ctx, `Ihre Buchungsbestätigung – ${data.vehicleName}`, {
    preheader: `Reservierung ${data.vehicleName}, ${fmtDateMaybeTime(data.startDate)}`,
    body,
  });
}

export interface ContractMailData {
  customerName: string;
  bookingRef: string;
}

/** Signed contract (with the AGB) as attachment. */
export function contract(data: ContractMailData, ctx: TemplateContext): RenderedEmail {
  const body = [
    greeting(data.customerName),
    p('Vielen Dank, dass Sie sich für HoppDrive entschieden haben.'),
    p('Anbei finden Sie Ihren unterschriebenen Mietvertrag inklusive AGB als PDF.'),
    p('Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.'),
    signOff(),
  ].join('\n');
  return build(ctx, `Ihr HoppDrive Mietvertrag – ${data.bookingRef}`, { preheader: 'Ihr unterschriebener Mietvertrag.', body });
}

export interface ContractPackageData {
  customerName: string;
  bookingRef: string;
  vehicleName: string;
  startDate: Date;
  endDate: Date;
  /** What is attached, to describe the mail accurately. */
  includes: { contract: boolean; damageReport: boolean; invoice: boolean };
}

/** Contract package: signed contract, damage report and invoice (whatever exists) as attachments. */
export function contractPackage(data: ContractPackageData, ctx: TemplateContext): RenderedEmail {
  const items: string[] = [];
  if (data.includes.contract) items.push('Ihr unterschriebener Mietvertrag inklusive AGB');
  if (data.includes.damageReport) items.push('das Fahrzeug-Übergabeprotokoll (Schadenbericht mit Fotos)');
  if (data.includes.invoice) items.push('Ihre Rechnung');
  const list = items.length
    ? `<ul style="margin:0 0 16px;padding-left:20px">${items.map((i) => `<li style="margin:0 0 4px">${esc(i)}</li>`).join('')}</ul>`
    : '';
  const body = [
    greeting(data.customerName),
    p('Vielen Dank, dass Sie sich für HoppDrive entschieden haben. Im Anhang finden Sie:'),
    list,
    detailBox([
      ['Buchung', data.bookingRef],
      ['Fahrzeug', data.vehicleName],
      ['Übergabe', fmtDateMaybeTime(data.startDate)],
      ['Rückgabe', fmtDateMaybeTime(data.endDate)],
    ]),
    p('Bitte bewahren Sie die Unterlagen für die Dauer der Miete auf. Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.'),
    signOff(),
  ].join('\n');
  return build(ctx, `Ihre HoppDrive Unterlagen – ${data.bookingRef}`, {
    preheader: 'Mietvertrag, Übergabeprotokoll und Rechnung.',
    body,
  });
}
