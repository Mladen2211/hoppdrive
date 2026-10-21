export type EmailProviderName = 'brevo' | 'smtp' | 'listmonk' | 'log';

export interface OutgoingAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface OutgoingEmail {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  /** Plain-text alternative. */
  text?: string;
  attachments: OutgoingAttachment[];
  fromEmail: string;
  fromName: string;
}

export interface TransportResult {
  providerMessageId?: string;
}

/** One way of getting a mail out of the door. Throw to signal a failed attempt (the outbox retries). */
export interface EmailTransport {
  readonly name: EmailProviderName;
  /** false when required credentials / URLs are missing (sending will fail with a clear message). */
  isConfigured(): boolean;
  /** Non-secret facts for the admin status page (host, URL, template id, ...). */
  describe(): Record<string, string | number | boolean>;
  send(mail: OutgoingEmail): Promise<TransportResult>;
}
