import type { IEmailService } from '../../application/interfaces/IEmailService';

/**
 * Brevo (formerly Sendinblue) email integration.
 * In production, use @getbrevo/brevo SDK.
 * This is a structured placeholder that logs the operations.
 */
export class BrevoEmailService implements IEmailService {
  constructor(
    private apiKey: string,
    private senderEmail: string,
    private senderName: string,
    private adminEmail: string,
  ) {}

  async sendContactConfirmation(to: string, customerName: string): Promise<void> {
    if (!this.apiKey) {
      console.log(`[Email] SKIP (no API key) – Confirmation to ${to}`);
      return;
    }

    // In production:
    // const brevo = new SibApiV3Sdk.TransactionalEmailsApi();
    // brevo.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, this.apiKey);
    // await brevo.sendTransacEmail({
    //   sender: { email: this.senderEmail, name: this.senderName },
    //   to: [{ email: to, name: customerName }],
    //   subject: 'Your inquiry has been received – HoppDrive',
    //   htmlContent: `<p>Dear ${customerName},</p><p>Thank you for your inquiry. We will get back to you within 24 hours.</p>`,
    // });

    console.log(`[Email] Sent confirmation to ${to} (${customerName})`);
  }

  async sendAdminNotification(
    contactRequestId: string,
    customerName: string,
    message: string,
  ): Promise<void> {
    if (!this.apiKey) {
      console.log(`[Email] SKIP (no API key) – Admin notification for request ${contactRequestId}`);
      return;
    }

    console.log(
      `[Email] Sent admin notification to ${this.adminEmail} – New inquiry from ${customerName}: "${message.substring(0, 50)}..."`,
    );
  }

  /**
   * Send signed rental contract PDF via email.
   * Ready for Brevo integration — currently logs the action.
   * When Brevo is configured, uncomment the SDK call below.
   */
  async sendContractEmail(options: {
    to: string;
    customerName: string;
    bookingId: string;
    pdfBytes: Uint8Array;
  }): Promise<void> {
    const { to, customerName, bookingId, pdfBytes } = options;

    if (!this.apiKey) {
      console.log(
        `[Email] SKIP (no API key) – Contract email to ${to} for booking ${bookingId} (${(pdfBytes.length / 1024).toFixed(1)} KB PDF)`,
      );
      return;
    }

    // ─── Brevo SDK integration (uncomment when API key is set) ──────
    // const SibApiV3Sdk = require('@getbrevo/brevo');
    // const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    // apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, this.apiKey);
    // await apiInstance.sendTransacEmail({
    //   sender: { email: this.senderEmail, name: this.senderName },
    //   to: [{ email: to, name: customerName }],
    //   subject: `Ihr HoppDrive Mietvertrag – ${bookingId.substring(0, 8).toUpperCase()}`,
    //   htmlContent: [
    //     `<p>Guten Tag ${customerName},</p>`,
    //     `<p>Vielen Dank, dass Sie sich für HoppDrive entschieden haben.</p>`,
    //     `<p>Anbei finden Sie Ihren unterschriebenen Mietvertrag als PDF.</p>`,
    //     `<p>Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</p>`,
    //     `<p>Freundliche Grüsse,<br/>Ihr HoppDrive Team</p>`,
    //   ].join(''),
    //   attachment: [{
    //     name: `HoppDrive_Mietvertrag_${bookingId.substring(0, 8).toUpperCase()}.pdf`,
    //     content: Buffer.from(pdfBytes).toString('base64'),
    //   }],
    // });

    console.log(
      `[Email] Sent contract to ${to} (${customerName}) for booking ${bookingId} – ${(pdfBytes.length / 1024).toFixed(1)} KB PDF`,
    );
  }
}
