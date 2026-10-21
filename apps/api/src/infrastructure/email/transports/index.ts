import { BrevoTransport } from './BrevoTransport';
import { SmtpTransport } from './SmtpTransport';
import { ListmonkTransport } from './ListmonkTransport';
import { LogTransport } from './LogTransport';
import type { EmailProviderName, EmailTransport } from './types';

export * from './types';
export { BrevoTransport, SmtpTransport, ListmonkTransport, LogTransport };

const PROVIDERS: readonly EmailProviderName[] = ['brevo', 'smtp', 'listmonk', 'log'];

/** EMAIL_PROVIDER, or brevo when BREVO_API_KEY is set, else log. */
export function resolveProviderName(env: NodeJS.ProcessEnv = process.env): EmailProviderName {
  const requested = (env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if ((PROVIDERS as readonly string[]).includes(requested)) return requested as EmailProviderName;
  if (requested) console.warn(`[Email] Unknown EMAIL_PROVIDER "${requested}" (use brevo | smtp | listmonk | log).`);
  return env.BREVO_API_KEY ? 'brevo' : 'log';
}

/** Builds the transport from environment variables. */
export function createTransportFromEnv(env: NodeJS.ProcessEnv = process.env): EmailTransport {
  switch (resolveProviderName(env)) {
    case 'brevo':
      return new BrevoTransport(env.BREVO_API_KEY || '');
    case 'smtp':
      return new SmtpTransport({
        host: env.SMTP_HOST || '',
        port: Number(env.SMTP_PORT) || 587,
        secure: ['1', 'true', 'yes'].includes((env.SMTP_SECURE || '').toLowerCase()),
        user: env.SMTP_USER || '',
        pass: env.SMTP_PASS || '',
      });
    case 'listmonk':
      return new ListmonkTransport({
        url: env.LISTMONK_URL || '',
        user: env.LISTMONK_USER || '',
        token: env.LISTMONK_TOKEN || '',
        templateId: Number(env.LISTMONK_TX_TEMPLATE_ID),
      });
    default:
      return new LogTransport();
  }
}
