import { randomUUID } from 'crypto';
import type { EmailTransport, OutgoingEmail, TransportResult } from './types';

/**
 * Development transport: nothing leaves the machine. Prints the mail and every link that carries a
 * `token=` (invite / password reset / unsubscribe), because without a real mail account those links
 * would otherwise be unreachable.
 */
export class LogTransport implements EmailTransport {
  readonly name = 'log' as const;

  isConfigured(): boolean {
    return true;
  }

  describe() {
    return { note: 'Entwicklungsmodus: E-Mails werden nur in die Konsole geschrieben.' };
  }

  async send(mail: OutgoingEmail): Promise<TransportResult> {
    const links = Array.from(mail.html.matchAll(/href="([^"]*token=[^"]*)"/g)).map((m) => m[1].replace(/&amp;/g, '&'));
    console.log(
      `[Email][log] "${mail.subject}" to ${mail.to}` +
        (mail.attachments.length ? ` (+${mail.attachments.length} Anhang/Anhänge: ${mail.attachments.map((a) => a.filename).join(', ')})` : ''),
    );
    for (const link of new Set(links)) console.log(`[Email][log]   link: ${link}`);
    return { providerMessageId: `log-${randomUUID()}` };
  }
}
