import { BrevoClient } from '@getbrevo/brevo';
import type { IEmailService } from '../../application/interfaces/IEmailService';

/**
 * Brevo (formerly Sendinblue) email integration, using the official
 * @getbrevo/brevo SDK (v6 — a from-scratch rewrite; its API bears no
 * resemblance to the older sib-api-v3-sdk-style calls, so don't copy
 * examples from pre-v6 docs).
 */
export class BrevoEmailService implements IEmailService {
  private client: BrevoClient | null;

  constructor(
    private apiKey: string,
    private senderEmail: string,
    private senderName: string,
    private adminEmail: string,
  ) {
    this.client = apiKey ? new BrevoClient({ apiKey }) : null;
  }

  private async send(options: {
    to: { email: string; name?: string }[];
    subject: string;
    htmlContent: string;
    attachment?: { name: string; content: string }[];
  }): Promise<void> {
    if (!this.client) {
      console.log(`[Email] SKIP (no API key) – "${options.subject}" to ${options.to.map((t) => t.email).join(', ')}`);
      return;
    }

    await this.client.transactionalEmails.sendTransacEmail({
      sender: { email: this.senderEmail, name: this.senderName },
      to: options.to,
      subject: options.subject,
      htmlContent: options.htmlContent,
      ...(options.attachment ? { attachment: options.attachment } : {}),
    });
  }

  async sendContactConfirmation(to: string, customerName: string): Promise<void> {
    await this.send({
      to: [{ email: to, name: customerName }],
      subject: 'Ihre Anfrage ist eingegangen – HoppDrive',
      htmlContent: [
        `<p>Guten Tag ${customerName},</p>`,
        `<p>Vielen Dank für Ihre Anfrage. Wir melden uns innerhalb von 24 Stunden bei Ihnen.</p>`,
        `<p>Freundliche Grüsse,<br/>Ihr HoppDrive Team</p>`,
      ].join(''),
    });
  }

  async sendAdminNotification(
    contactRequestId: string,
    customerName: string,
    message: string,
  ): Promise<void> {
    await this.send({
      to: [{ email: this.adminEmail }],
      subject: `Neue Anfrage von ${customerName}`,
      htmlContent: `<p>Neue Anfrage (${contactRequestId}) von <strong>${customerName}</strong>:</p><p>${message}</p>`,
    });
  }

  /**
   * Send signed rental contract PDF (contract clauses + attached AGB) via email.
   */
  async sendContractEmail(options: {
    to: string;
    customerName: string;
    bookingId: string;
    pdfBytes: Uint8Array;
  }): Promise<void> {
    const { to, customerName, bookingId, pdfBytes } = options;
    const ref = bookingId.substring(0, 8).toUpperCase();

    await this.send({
      to: [{ email: to, name: customerName }],
      subject: `Ihr HoppDrive Mietvertrag – ${ref}`,
      htmlContent: [
        `<p>Guten Tag ${customerName},</p>`,
        `<p>Vielen Dank, dass Sie sich für HoppDrive entschieden haben.</p>`,
        `<p>Anbei finden Sie Ihren unterschriebenen Mietvertrag inklusive AGB als PDF.</p>`,
        `<p>Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</p>`,
        `<p>Freundliche Grüsse,<br/>Ihr HoppDrive Team</p>`,
      ].join(''),
      attachment: [{
        name: `HoppDrive_Mietvertrag_${ref}.pdf`,
        content: Buffer.from(pdfBytes).toString('base64'),
      }],
    });
  }

  async sendBookingConfirmation(options: {
    to: string;
    customerName: string;
    vehicleName: string;
    startDate: Date;
    endDate: Date;
    totalPrice: number;
    currency: string;
  }): Promise<void> {
    const { to, customerName, vehicleName, startDate, endDate, totalPrice, currency } = options;
    const fmt = (d: Date) => d.toLocaleDateString('de-CH');

    await this.send({
      to: [{ email: to, name: customerName }],
      subject: `Ihre Buchungsbestätigung – ${vehicleName}`,
      htmlContent: [
        `<p>Guten Tag ${customerName},</p>`,
        `<p>Ihre Reservierung für <strong>${vehicleName}</strong> vom ${fmt(startDate)} bis ${fmt(endDate)} wurde erfasst.</p>`,
        `<p>Gesamtpreis: <strong>${currency} ${totalPrice.toFixed(2)}</strong></p>`,
        `<p>Wir freuen uns auf Sie!</p>`,
        `<p>Freundliche Grüsse,<br/>Ihr HoppDrive Team</p>`,
      ].join(''),
    });
  }

  async sendInvoiceEmail(options: {
    to: string;
    customerName: string;
    invoiceNumber: string;
    pdfBytes: Uint8Array;
  }): Promise<void> {
    const { to, customerName, invoiceNumber, pdfBytes } = options;

    await this.send({
      to: [{ email: to, name: customerName }],
      subject: `Ihre Rechnung ${invoiceNumber} – HoppDrive`,
      htmlContent: [
        `<p>Guten Tag ${customerName},</p>`,
        `<p>Anbei erhalten Sie Ihre Rechnung <strong>${invoiceNumber}</strong> als PDF.</p>`,
        `<p>Freundliche Grüsse,<br/>Ihr HoppDrive Team</p>`,
      ].join(''),
      attachment: [{
        name: `HoppDrive_Rechnung_${invoiceNumber}.pdf`,
        content: Buffer.from(pdfBytes).toString('base64'),
      }],
    });
  }

  async sendDeclineEmail(options: {
    to: string;
    customerName: string;
    reason?: string;
  }): Promise<void> {
    const { to, customerName, reason } = options;

    await this.send({
      to: [{ email: to, name: customerName }],
      subject: 'Ihre Anfrage bei HoppDrive',
      htmlContent: [
        `<p>Guten Tag ${customerName},</p>`,
        `<p>Leider können wir Ihre Anfrage derzeit nicht bestätigen.</p>`,
        reason ? `<p>${reason}</p>` : '',
        `<p>Gerne helfen wir Ihnen bei einer alternativen Buchung weiter.</p>`,
        `<p>Freundliche Grüsse,<br/>Ihr HoppDrive Team</p>`,
      ].join(''),
    });
  }

  async sendPromotionalEmail(options: {
    to: string;
    customerName: string;
    subject: string;
    htmlContent: string;
  }): Promise<void> {
    await this.send({
      to: [{ email: options.to, name: options.customerName }],
      subject: options.subject,
      htmlContent: options.htmlContent,
    });
  }
}
