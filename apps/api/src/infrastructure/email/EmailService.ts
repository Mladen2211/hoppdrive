import { randomUUID } from 'crypto';
import type { EmailMessage, Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../application/errors';
import type {
  EmailAttachmentInput,
  EmailRelated,
  EmailSendResult,
  IEmailService,
} from '../../application/interfaces/IEmailService';
import type { AdminRole } from '@hoppdrive/shared';
import { PrivateStorageService } from '../services/PrivateStorageService';
import type { SettingsService } from '../services/SettingsService';
import {
  isSensitiveTemplate,
  htmlToText,
  renderEmailTemplate,
  type EmailTemplateData,
  type EmailTemplateKey,
  type TemplateContext,
} from './templates';
import type { EmailTransport, OutgoingAttachment } from './transports';

/** One initial attempt + 3 retries. */
export const MAX_EMAIL_ATTEMPTS = 4;
/** Wait before retry n (1-based): 1 min, 5 min, 30 min. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000];
/** A claimed message that is not settled within this time is picked up again (crash safety). */
const LEASE_MS = 5 * 60_000;

export interface EmailServiceConfig {
  fromEmail: string;
  fromName: string;
  /** Fallback recipient of the internal "new inquiry" mail. */
  adminNotificationEmail: string;
  /** Public website base URL (no trailing slash), used for the logo and links. */
  siteUrl: string;
  logoUrl: string;
  /** Admin app base URL (no trailing slash). */
  adminUrl: string;
}

interface StoredAttachment {
  filename: string;
  storageKey: string;
  contentType: string;
}

export interface SendOptions<K extends EmailTemplateKey> {
  template: K;
  data: EmailTemplateData<K>;
  to: string;
  toName?: string | null;
  attachments?: EmailAttachmentInput[];
  related?: EmailRelated;
  /** Try to deliver right away (default). false leaves the message for the worker (bulk mail). */
  immediate?: boolean;
}

/** Return a reason to refuse sending (the message then fails permanently), or null to go ahead. */
export type BeforeSendGuard = (message: EmailMessage) => Promise<string | null> | string | null;
/** Called after a message reached SENT or FAILED. */
export type SettledListener = (message: EmailMessage) => Promise<void> | void;

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain',
  csv: 'text/csv',
};

function mimeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

function errorText(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 1000);
}

/**
 * The single place that sends e-mail.
 *
 * - Builds branded German HTML from templates (infrastructure/email/templates).
 * - Writes every message to the outbox / log table (EmailMessage).
 * - Delivers through the configured transport (brevo | smtp | listmonk | log), first inline, then, if that
 *   fails, via the worker (EmailWorker) with exponential backoff. Safe across restarts and multiple
 *   instances: a message is claimed with an atomic UPDATE and leased for a few minutes.
 */
export class EmailService implements IEmailService {
  private guards: BeforeSendGuard[] = [];
  private listeners: SettledListener[] = [];

  constructor(
    private prisma: PrismaClient,
    private transport: EmailTransport,
    private storage: PrivateStorageService,
    private settings: SettingsService,
    private config: EmailServiceConfig,
  ) {}

  get providerName(): string {
    return this.transport.name;
  }

  /** Marketing registers a guard that blocks mails to unsubscribed addresses. */
  addBeforeSendGuard(guard: BeforeSendGuard): void {
    this.guards.push(guard);
  }

  /** Marketing registers a listener that updates campaign recipients when their mail settles. */
  onSettled(listener: SettledListener): void {
    this.listeners.push(listener);
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Generic API (also for code in other modules)                *
   * ──────────────────────────────────────────────────────────── */

  /**
   * Renders a template, writes it to the outbox and (unless `immediate: false`) tries to deliver it.
   * Throws only when the message cannot be stored (invalid recipient, database down).
   */
  async send<K extends EmailTemplateKey>(options: SendOptions<K>): Promise<EmailSendResult> {
    // Addresses are matched case-insensitively everywhere (log filters, unsubscribe guard), so store them lower-case.
    const to = options.to?.trim().toLowerCase();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new AppError('Ungültige Empfängeradresse.', 422, 'invalid_recipient');
    }

    const ctx = await this.context();
    const rendered = renderEmailTemplate(options.template, options.data, ctx);
    const id = randomUUID();
    const attachments = await this.storeAttachments(id, options.attachments ?? []);

    await this.prisma.emailMessage.create({
      data: {
        id,
        to,
        toName: options.toName ?? null,
        subject: rendered.subject.slice(0, 500),
        template: options.template,
        html: rendered.html,
        attachments: attachments as unknown as Prisma.InputJsonValue,
        status: 'QUEUED',
        attempts: 0,
        relatedType: options.related?.type ?? null,
        relatedId: options.related?.id ?? null,
      },
    });

    if (options.immediate === false) return { id, status: 'QUEUED' };
    return this.attemptNow(id);
  }

  /**
   * Re-sends a message from the log.
   * FAILED / QUEUED rows are reset and retried (same row); a SENT row is copied into a new row.
   * Messages with one-time links (invite, password reset) cannot be re-sent: their HTML is wiped.
   */
  async resend(id: string): Promise<EmailSendResult> {
    const msg = await this.prisma.emailMessage.findUnique({ where: { id } });
    if (!msg) throw new AppError('E-Mail nicht gefunden.', 404, 'not_found');
    if (isSensitiveTemplate(msg.template) || !msg.html) {
      throw new AppError(
        'Diese Nachricht enthält einen Einmal-Link und kann nicht erneut gesendet werden. Bitte lösen Sie die Aktion neu aus (z. B. Benutzer erneut einladen).',
        409,
        'not_resendable',
      );
    }

    if (msg.status === 'SENT') {
      const copyId = randomUUID();
      const attachments = await this.copyAttachments(msg, copyId);
      await this.prisma.emailMessage.create({
        data: {
          id: copyId,
          to: msg.to,
          toName: msg.toName,
          subject: msg.subject,
          template: msg.template,
          html: msg.html,
          attachments: attachments as unknown as Prisma.InputJsonValue,
          status: 'QUEUED',
          attempts: 0,
          relatedType: msg.relatedType,
          relatedId: msg.relatedId,
        },
      });
      return this.attemptNow(copyId);
    }

    await this.prisma.emailMessage.update({
      where: { id },
      data: { status: 'QUEUED', attempts: 0, error: null, nextAttemptAt: null },
    });
    return this.attemptNow(id);
  }

  /** Deletes log rows (and their stored attachments) older than `days`. Returns the number removed. */
  async purgeOld(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const old = await this.prisma.emailMessage.findMany({
      where: { createdAt: { lt: cutoff }, status: { in: ['SENT', 'FAILED'] } },
      select: { id: true },
      take: 500,
    });
    for (const { id } of old) {
      await this.storage.deletePrefix(`email/${id}`).catch(() => undefined);
    }
    if (old.length === 0) return 0;
    const result = await this.prisma.emailMessage.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    return result.count;
  }

  /** Provider facts + queue numbers for the admin status page. */
  async getStatus() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [queued, failed, sentTotal, sent24h, failed24h, oldest, lastSent] = await Promise.all([
      this.prisma.emailMessage.count({ where: { status: 'QUEUED' } }),
      this.prisma.emailMessage.count({ where: { status: 'FAILED' } }),
      this.prisma.emailMessage.count({ where: { status: 'SENT' } }),
      this.prisma.emailMessage.count({ where: { status: 'SENT', sentAt: { gte: since } } }),
      this.prisma.emailMessage.count({ where: { status: 'FAILED', updatedAt: { gte: since } } }),
      this.prisma.emailMessage.findFirst({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      this.prisma.emailMessage.findFirst({ where: { status: 'SENT' }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } }),
    ]);
    return {
      provider: this.transport.name,
      configured: this.transport.isConfigured(),
      /** false for the log provider: mails are only printed to the server console. */
      deliversExternally: this.transport.name !== 'log',
      from: { email: this.config.fromEmail, name: this.config.fromName },
      details: this.transport.describe(),
      queue: {
        queued,
        failed,
        sent: sentTotal,
        sentLast24h: sent24h,
        failedLast24h: failed24h,
        oldestQueuedAt: oldest?.createdAt ?? null,
        lastSentAt: lastSent?.sentAt ?? null,
      },
      maxAttempts: MAX_EMAIL_ATTEMPTS,
    };
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Delivery (used inline and by the worker)                    *
   * ──────────────────────────────────────────────────────────── */

  /** Claims and delivers one message immediately. */
  private async attemptNow(id: string): Promise<EmailSendResult> {
    const msg = await this.claim(id);
    if (!msg) {
      const current = await this.prisma.emailMessage.findUnique({ where: { id } });
      return { id, status: current?.status ?? 'QUEUED', ...(current?.error ? { error: current.error } : {}) };
    }
    const settled = await this.deliver(msg);
    return {
      id,
      status: settled.status,
      ...(settled.status !== 'SENT' && settled.error ? { error: settled.error } : {}),
    };
  }

  /**
   * Atomically takes a due message: attempts + 1 and a lease (so it is not picked twice).
   * Returns the claimed row, or null when another worker was faster / the message is not due.
   */
  async claim(id: string): Promise<EmailMessage | null> {
    const now = new Date();
    const claimed = await this.prisma.emailMessage.updateMany({
      where: {
        id,
        status: 'QUEUED',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: { attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + LEASE_MS) },
    });
    if (claimed.count !== 1) return null;
    return this.prisma.emailMessage.findUnique({ where: { id } });
  }

  /** Ids of messages that are due (oldest first). */
  async findDueIds(limit: number): Promise<string[]> {
    const now = new Date();
    const rows = await this.prisma.emailMessage.findMany({
      where: { status: 'QUEUED', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Sends one claimed message and records the outcome. Never throws. */
  async deliver(msg: EmailMessage): Promise<EmailMessage> {
    const sensitive = isSensitiveTemplate(msg.template);
    let updated: EmailMessage;
    try {
      for (const guard of this.guards) {
        const reason = await guard(msg);
        if (reason) {
          updated = await this.prisma.emailMessage.update({
            where: { id: msg.id },
            data: {
              status: 'FAILED',
              error: reason,
              nextAttemptAt: null,
              provider: this.transport.name,
              ...(sensitive ? { html: '' } : {}),
            },
          });
          await this.notifySettled(updated);
          return updated;
        }
      }

      const outgoing = await this.toOutgoing(msg);
      const result = await this.transport.send(outgoing);
      updated = await this.prisma.emailMessage.update({
        where: { id: msg.id },
        data: {
          status: 'SENT',
          error: null,
          nextAttemptAt: null,
          sentAt: new Date(),
          provider: this.transport.name,
          providerMessageId: result.providerMessageId?.slice(0, 300) ?? null,
          ...(sensitive ? { html: '' } : {}),
        },
      });
    } catch (err) {
      const terminal = msg.attempts >= MAX_EMAIL_ATTEMPTS;
      const wait = BACKOFF_MS[Math.min(msg.attempts - 1, BACKOFF_MS.length - 1)];
      console.error(`[Email] Delivery failed (${msg.template} to ${msg.to}, attempt ${msg.attempts}/${MAX_EMAIL_ATTEMPTS}):`, errorText(err));
      updated = await this.prisma.emailMessage.update({
        where: { id: msg.id },
        data: {
          status: terminal ? 'FAILED' : 'QUEUED',
          error: errorText(err),
          nextAttemptAt: terminal ? null : new Date(Date.now() + wait),
          provider: this.transport.name,
          ...(terminal && sensitive ? { html: '' } : {}),
        },
      });
    }
    if (updated.status !== 'QUEUED') await this.notifySettled(updated);
    return updated;
  }

  private async notifySettled(msg: EmailMessage): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener(msg);
      } catch (err) {
        console.error('[Email] Settled listener failed:', err);
      }
    }
  }

  private async toOutgoing(msg: EmailMessage) {
    const stored = (msg.attachments as unknown as StoredAttachment[] | null) ?? [];
    const attachments: OutgoingAttachment[] = [];
    for (const a of stored) {
      attachments.push({
        filename: a.filename,
        contentType: a.contentType || mimeFor(a.filename),
        content: await this.storage.read(a.storageKey),
      });
    }
    return {
      to: msg.to,
      toName: msg.toName,
      subject: msg.subject,
      html: msg.html,
      text: htmlToText(msg.html),
      attachments,
      fromEmail: this.config.fromEmail,
      fromName: this.config.fromName,
    };
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Attachments                                                  *
   * ──────────────────────────────────────────────────────────── */

  private async storeAttachments(messageId: string, inputs: EmailAttachmentInput[]): Promise<StoredAttachment[]> {
    const stored: StoredAttachment[] = [];
    let index = 0;
    for (const input of inputs) {
      index++;
      const filename = PrivateStorageService.safeName(input.filename);
      const contentType = input.contentType || mimeFor(filename);
      if (input.storageKey) {
        if (!(await this.storage.exists(input.storageKey))) {
          throw new AppError(`Anhang nicht gefunden: ${filename}`, 422, 'attachment_missing');
        }
        stored.push({ filename, storageKey: input.storageKey, contentType });
      } else if (input.bytes) {
        const key = PrivateStorageService.keys.emailAttachment(messageId, `${index}-${filename}`);
        await this.storage.save(key, input.bytes);
        stored.push({ filename, storageKey: key, contentType });
      }
    }
    return stored;
  }

  /** Copies the attachment files of `msg` below the new message's prefix (keeps retention clean-up independent). */
  private async copyAttachments(msg: EmailMessage, newId: string): Promise<StoredAttachment[]> {
    const stored = (msg.attachments as unknown as StoredAttachment[] | null) ?? [];
    const copies: StoredAttachment[] = [];
    let index = 0;
    for (const a of stored) {
      index++;
      const key = PrivateStorageService.keys.emailAttachment(newId, `${index}-${a.filename}`);
      await this.storage.save(key, await this.storage.read(a.storageKey));
      copies.push({ ...a, storageKey: key });
    }
    return copies;
  }

  private async context(): Promise<TemplateContext> {
    return {
      company: await this.settings.getCompany(),
      siteUrl: this.config.siteUrl,
      logoUrl: this.config.logoUrl,
    };
  }

  /* ──────────────────────────────────────────────────────────── *
   *  IEmailService (typed convenience methods)                   *
   * ──────────────────────────────────────────────────────────── */

  sendContactConfirmation(
    to: string,
    customerName: string,
    details?: { vehicleOfInterest?: string | null; desiredStart?: Date | null; desiredEnd?: Date | null },
  ): Promise<EmailSendResult> {
    return this.send({
      template: 'inquiry_received',
      to,
      toName: customerName,
      data: { customerName, ...details },
    });
  }

  sendAdminNotification(
    contactRequestId: string,
    customerName: string,
    message: string,
    toOverride?: string,
  ): Promise<EmailSendResult> {
    return this.send({
      template: 'admin_notification',
      to: toOverride || this.config.adminNotificationEmail,
      data: {
        contactRequestId,
        customerName,
        message,
        inquiryUrl: `${this.config.adminUrl}/inquiries`,
      },
      related: { type: 'contact_request', id: contactRequestId },
    });
  }

  sendContractEmail(options: { to: string; customerName: string; bookingId: string; pdfBytes: Uint8Array }) {
    const ref = options.bookingId.substring(0, 8).toUpperCase();
    return this.send({
      template: 'contract',
      to: options.to,
      toName: options.customerName,
      data: { customerName: options.customerName, bookingRef: ref },
      attachments: [{ filename: `HoppDrive_Mietvertrag_${ref}.pdf`, bytes: options.pdfBytes, contentType: 'application/pdf' }],
      related: { type: 'booking', id: options.bookingId },
    });
  }

  sendBookingConfirmation(options: Parameters<IEmailService['sendBookingConfirmation']>[0]) {
    return this.send({
      template: 'booking_confirmation',
      to: options.to,
      toName: options.customerName,
      data: {
        customerName: options.customerName,
        vehicleName: options.vehicleName,
        startDate: options.startDate,
        endDate: options.endDate,
        totalPrice: options.totalPrice,
        currency: options.currency,
        discountAmount: options.discountAmount,
        bookingRef: options.bookingRef,
      },
      related: options.related,
    });
  }

  sendInvoiceEmail(options: Parameters<IEmailService['sendInvoiceEmail']>[0]) {
    const attachments: EmailAttachmentInput[] = [
      { filename: `HoppDrive_Rechnung_${options.invoiceNumber}.pdf`, bytes: options.pdfBytes, contentType: 'application/pdf' },
    ];
    if (options.reminder) {
      return this.send({
        template: 'dunning',
        to: options.to,
        toName: options.customerName,
        data: {
          customerName: options.customerName,
          invoiceNumber: options.invoiceNumber,
          originalInvoiceNumber: options.reminder.originalInvoiceNumber,
          dueDate: options.reminder.dueDate,
          total: options.total,
          currency: options.currency,
          note: options.reminder.note,
        },
        attachments,
        related: options.related,
      });
    }
    return this.send({
      template: 'invoice',
      to: options.to,
      toName: options.customerName,
      data: {
        customerName: options.customerName,
        invoiceNumber: options.invoiceNumber,
        total: options.total,
        currency: options.currency,
        dueDate: options.dueDate,
        withQrBill: options.withQrBill,
      },
      attachments,
      related: options.related,
    });
  }

  sendDeclineEmail(options: { to: string; customerName: string; reason?: string }) {
    return this.send({
      template: 'inquiry_declined',
      to: options.to,
      toName: options.customerName,
      data: { customerName: options.customerName, reason: options.reason },
    });
  }

  sendAdminInvite(options: { to: string; inviteUrl: string; invitedBy: string; role: AdminRole }) {
    return this.send({
      template: 'admin_invite',
      to: options.to,
      data: { inviteUrl: options.inviteUrl, invitedBy: options.invitedBy, role: options.role },
    });
  }

  sendAdminInviteAccepted(options: { to: string; name: string; role: AdminRole }) {
    return this.send({
      template: 'admin_invite_accepted',
      to: options.to,
      toName: options.name,
      data: { name: options.name, role: options.role, loginUrl: `${this.config.adminUrl}/login` },
    });
  }

  sendPasswordReset(options: { to: string; resetUrl: string; expiresInMinutes: number }) {
    return this.send({
      template: 'password_reset',
      to: options.to,
      data: { resetUrl: options.resetUrl, expiresInMinutes: options.expiresInMinutes },
    });
  }

  sendContractPackage(options: Parameters<IEmailService['sendContractPackage']>[0]) {
    return this.send({
      template: 'contract_package',
      to: options.to,
      toName: options.customerName,
      data: {
        customerName: options.customerName,
        bookingRef: options.bookingRef,
        vehicleName: options.vehicleName,
        startDate: options.startDate,
        endDate: options.endDate,
        includes: options.includes,
      },
      attachments: options.attachments,
      related: options.related,
    });
  }

  sendDamageInvoice(options: Parameters<IEmailService['sendDamageInvoice']>[0]) {
    return this.send({
      template: 'damage_invoice',
      to: options.to,
      toName: options.customerName,
      data: {
        customerName: options.customerName,
        invoiceNumber: options.invoiceNumber,
        total: options.total,
        currency: options.currency,
        dueDate: options.dueDate,
        vehicleName: options.vehicleName,
        bookingRef: options.bookingRef,
        damageLines: options.damageLines,
        withQrBill: options.withQrBill,
      },
      attachments: options.attachments,
      related: options.related,
    });
  }

  sendFineNotice(options: Parameters<IEmailService['sendFineNotice']>[0]) {
    return this.send({
      template: 'fine_notice',
      to: options.to,
      toName: options.customerName,
      data: {
        customerName: options.customerName,
        licensePlate: options.licensePlate,
        occurredAt: options.occurredAt,
        place: options.place,
        authority: options.authority,
        reference: options.reference,
        amount: options.amount,
        currency: options.currency,
        note: options.note,
      },
      attachments: options.attachments,
      related: options.related,
    });
  }

  sendFineInvoice(options: Parameters<IEmailService['sendFineInvoice']>[0]) {
    return this.send({
      template: 'fine_invoice',
      to: options.to,
      toName: options.customerName,
      data: {
        customerName: options.customerName,
        invoiceNumber: options.invoiceNumber,
        total: options.total,
        currency: options.currency,
        dueDate: options.dueDate,
        licensePlate: options.licensePlate,
        occurredAt: options.occurredAt,
        place: options.place,
        authority: options.authority,
        reference: options.reference,
        withQrBill: options.withQrBill,
      },
      attachments: options.attachments,
      related: options.related,
    });
  }

  sendDiscountCampaign(options: Parameters<IEmailService['sendDiscountCampaign']>[0]) {
    return this.send({
      template: 'discount_campaign',
      to: options.to,
      toName: options.recipientName,
      data: {
        recipientName: options.recipientName,
        subject: options.subject,
        message: options.message,
        code: options.code,
        discountText: options.discountText,
        validUntil: options.validUntil,
        bookUrl: `${this.config.siteUrl}/fahrzeuge`,
        unsubscribeUrl: options.unsubscribeUrl,
      },
      related: options.related,
      immediate: false,
    });
  }

  sendUnsubscribeConfirmation(to: string) {
    return this.send({ template: 'unsubscribe_confirmation', to, data: {} });
  }

  sendTest(to: string, sentBy?: string | null) {
    return this.send({
      template: 'test',
      to,
      data: { sentBy, provider: this.transport.name },
    });
  }
}
