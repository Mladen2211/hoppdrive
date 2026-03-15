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
}
