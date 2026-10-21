import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailTransport, OutgoingEmail, TransportResult } from './types';

export interface SmtpConfig {
  host: string;
  port: number;
  /** true = implicit TLS (port 465); false = STARTTLS when the server offers it (587 / 25). */
  secure: boolean;
  user: string;
  pass: string;
}

/** Any SMTP server (self-hosted Postfix, Mailcow, Google Workspace relay, ...) through nodemailer. */
export class SmtpTransport implements EmailTransport {
  readonly name = 'smtp' as const;
  private transporter: Transporter | null = null;

  constructor(private config: SmtpConfig) {}

  isConfigured(): boolean {
    return !!this.config.host;
  }

  describe() {
    return {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      authenticated: !!this.config.user,
    };
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        ...(this.config.user ? { auth: { user: this.config.user, pass: this.config.pass } } : {}),
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 45_000,
      });
    }
    return this.transporter;
  }

  async send(mail: OutgoingEmail): Promise<TransportResult> {
    if (!this.config.host) throw new Error('SMTP ist nicht konfiguriert (SMTP_HOST fehlt).');

    const info = await this.getTransporter().sendMail({
      from: { name: mail.fromName, address: mail.fromEmail },
      to: mail.toName ? { name: mail.toName, address: mail.to } : mail.to,
      subject: mail.subject,
      html: mail.html,
      ...(mail.text ? { text: mail.text } : {}),
      attachments: mail.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { providerMessageId: info.messageId };
  }
}
