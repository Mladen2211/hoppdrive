import type { EmailTransport, OutgoingEmail, TransportResult } from './types';

export interface ListmonkConfig {
  /** Base URL of the Listmonk instance, e.g. https://listmonk.example.com (no trailing slash). */
  url: string;
  /** API user name and its token (Listmonk: Settings > Users). */
  user: string;
  token: string;
  /** ID of the "passthrough" transactional template (see below). */
  templateId: number;
}

/**
 * Listmonk transactional API: POST {url}/api/tx.
 *
 * One-time setup in Listmonk: create a transactional template ("Campaigns > Templates", type
 * "Transactional") that passes through the rendered HTML:
 *     Subject:  {{ .Tx.Data.subject }}
 *     Body:     {{ .Tx.Data.html | Safe }}
 * and put its ID into LISTMONK_TX_TEMPLATE_ID.
 *
 * Requests use `subscriber_mode: "external"`, so the recipient does not have to exist as a subscriber.
 * Without attachments the body is JSON. With attachments Listmonk expects multipart/form-data: the JSON
 * payload in a `data` field and every attachment as a `file` part.
 */
export class ListmonkTransport implements EmailTransport {
  readonly name = 'listmonk' as const;

  constructor(private config: ListmonkConfig) {}

  isConfigured(): boolean {
    const c = this.config;
    return !!(c.url && c.user && c.token && Number.isFinite(c.templateId) && c.templateId > 0);
  }

  describe() {
    return {
      url: this.config.url,
      templateId: this.config.templateId,
      user: this.config.user,
    };
  }

  async send(mail: OutgoingEmail): Promise<TransportResult> {
    if (!this.isConfigured()) {
      throw new Error('Listmonk ist nicht konfiguriert (LISTMONK_URL, LISTMONK_USER, LISTMONK_TOKEN, LISTMONK_TX_TEMPLATE_ID).');
    }

    const payload = {
      subscriber_email: mail.to,
      subscriber_mode: 'external',
      template_id: this.config.templateId,
      from_email: `${mail.fromName} <${mail.fromEmail}>`,
      // The template renders {{ .Tx.Data.subject }} / {{ .Tx.Data.html | Safe }}. `subject` is also sent
      // at the top level for Listmonk versions that accept it as an override.
      subject: mail.subject,
      content_type: 'html',
      data: { html: mail.html, subject: mail.subject },
    };

    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${this.config.user}:${this.config.token}`).toString('base64')}`,
      Accept: 'application/json',
    };
    let body: string | FormData;
    if (mail.attachments.length === 0) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    } else {
      // No Content-Type header here: fetch sets multipart/form-data with the right boundary.
      const form = new FormData();
      form.append('data', JSON.stringify(payload));
      for (const a of mail.attachments) {
        form.append('file', new Blob([a.content], { type: a.contentType }), a.filename);
      }
      body = form;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    let response: Response;
    try {
      response = await fetch(`${this.config.url.replace(/\/+$/, '')}/api/tx`, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      const reason = (err as Error).name === 'AbortError' ? 'Zeitüberschreitung' : (err as Error).message;
      throw new Error(`Listmonk nicht erreichbar: ${reason}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const text = (await response.text().catch(() => '')).slice(0, 500);
      let message = text;
      try {
        message = (JSON.parse(text) as { message?: string }).message ?? text;
      } catch {
        /* keep raw text */
      }
      throw new Error(`Listmonk antwortete mit ${response.status}: ${message || response.statusText}`);
    }
    return {};
  }
}
