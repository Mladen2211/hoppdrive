import { BrevoClient } from '@getbrevo/brevo';
import type { EmailTransport, OutgoingEmail, TransportResult } from './types';

/**
 * Brevo (formerly Sendinblue) through the official @getbrevo/brevo SDK (v6, a from-scratch rewrite;
 * do not copy examples from pre-v6 docs).
 */
export class BrevoTransport implements EmailTransport {
  readonly name = 'brevo' as const;
  private client: BrevoClient | null;

  constructor(private apiKey: string) {
    this.client = apiKey ? new BrevoClient({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  describe() {
    return { apiKeySet: !!this.apiKey };
  }

  async send(mail: OutgoingEmail): Promise<TransportResult> {
    if (!this.client) throw new Error('Brevo ist nicht konfiguriert (BREVO_API_KEY fehlt).');

    const response = await this.client.transactionalEmails.sendTransacEmail({
      sender: { email: mail.fromEmail, name: mail.fromName },
      to: [{ email: mail.to, ...(mail.toName ? { name: mail.toName } : {}) }],
      subject: mail.subject,
      htmlContent: mail.html,
      ...(mail.text ? { textContent: mail.text } : {}),
      ...(mail.attachments.length > 0
        ? { attachment: mail.attachments.map((a) => ({ name: a.filename, content: a.content.toString('base64') })) }
        : {}),
    });
    const messageId = (response as { messageId?: string } | undefined)?.messageId;
    return { providerMessageId: messageId };
  }
}
