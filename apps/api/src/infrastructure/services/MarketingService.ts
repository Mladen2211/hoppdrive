import { randomBytes } from 'crypto';
import type { MarketingPreference, Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../application/errors';
import type { IMarketingConsent } from '../../application/interfaces/IMarketingConsent';
import type { EmailService } from '../email/EmailService';
import { DiscountService } from './DiscountService';

/* ──────────────────────────────────────────────────────────── *
 *  Types                                                       *
 * ──────────────────────────────────────────────────────────── */

export interface CustomerRecord {
  email: string;
  name: string;
  phone: string | null;
  locale: string | null;
  bookingsCount: number;
  inquiriesCount: number;
  lastRentalAt: Date | null;
  lastActivityAt: Date | null;
  /** Explicit opt-in (preference or inquiry checkbox). */
  marketingConsent: boolean;
  unsubscribed: boolean;
  /** (consent OR at least one booking) AND NOT unsubscribed. */
  eligible: boolean;
}

export type CustomerFilter = 'all' | 'eligible' | 'consent' | 'customers' | 'unsubscribed';

export interface CampaignCodeInput {
  /** SHARED: use this existing code. */
  id?: string;
  /** SHARED (new code): optional custom code text; generated when omitted. */
  code?: string;
  label?: string | null;
  type?: 'PERCENT' | 'FIXED';
  value?: number;
  currency?: string | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  minDays?: number | null;
  /** SHARED (new code) only. PERSONAL codes are always single-use. */
  maxRedemptions?: number | null;
  perEmailLimit?: number;
}

export interface CreateCampaignInput {
  subject: string;
  message: string;
  recipients: { mode: 'all' } | { mode: 'selected'; emails: string[] };
  codeMode: 'NONE' | 'SHARED' | 'PERSONAL';
  code?: CampaignCodeInput;
}

export const MAX_CAMPAIGN_RECIPIENTS = 2000;
const RECIPIENT_RELATED = 'marketing_recipient';

const newToken = () => randomBytes(24).toString('base64url');

/**
 * Marketing: consent / unsubscribe state, the customer directory and discount campaigns.
 *
 * Who may be mailed ("eligible") is decided HERE, on the server, never by the client:
 *   (explicit consent OR at least one non-cancelled booking) AND NOT unsubscribed.
 */
export class MarketingService implements IMarketingConsent {
  constructor(
    private prisma: PrismaClient,
    private email: EmailService,
    private discounts: DiscountService,
    private config: { siteUrl: string },
  ) {
    // Block queued campaign mails when the recipient unsubscribed in the meantime.
    this.email.addBeforeSendGuard(async (msg) => {
      if (msg.template !== 'discount_campaign') return null;
      const pref = await this.prisma.marketingPreference.findUnique({ where: { email: msg.to.toLowerCase() } });
      return pref?.unsubscribedAt ? 'Empfänger hat sich abgemeldet.' : null;
    });
    // Keep recipient rows and the campaign "sent" marker in step with the outbox.
    this.email.onSettled(async (msg) => {
      if (msg.relatedType !== RECIPIENT_RELATED || !msg.relatedId) return;
      const recipient = await this.prisma.marketingRecipient.update({
        where: { id: msg.relatedId },
        data: {
          status: msg.status === 'SENT' ? 'SENT' : 'FAILED',
          error: msg.status === 'SENT' ? null : msg.error,
          sentAt: msg.status === 'SENT' ? (msg.sentAt ?? new Date()) : null,
        },
        select: { campaignId: true },
      });
      const open = await this.prisma.marketingRecipient.count({
        where: { campaignId: recipient.campaignId, status: 'QUEUED' },
      });
      if (open === 0) {
        await this.prisma.marketingCampaign.updateMany({
          where: { id: recipient.campaignId, sentAt: null },
          data: { sentAt: new Date() },
        });
      }
    });
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Preferences / unsubscribe                                   *
   * ──────────────────────────────────────────────────────────── */

  /** Finds or creates the preference row (and its unsubscribe token) for an address. */
  async ensurePreference(
    emailAddress: string,
    defaults: { consent?: boolean; source?: string } = {},
  ): Promise<MarketingPreference> {
    const email = emailAddress.trim().toLowerCase();
    const existing = await this.prisma.marketingPreference.findUnique({ where: { email } });
    if (existing) return existing;
    try {
      return await this.prisma.marketingPreference.create({
        data: {
          email,
          consent: defaults.consent ?? false,
          source: defaults.source ?? 'customer',
          unsubscribeToken: newToken(),
        },
      });
    } catch (err) {
      // Lost a race with a concurrent insert for the same address.
      const again = await this.prisma.marketingPreference.findUnique({ where: { email } });
      if (again) return again;
      throw err;
    }
  }

  async recordOptIn(emailAddress: string, source: 'contact_form' | 'admin'): Promise<void> {
    const email = emailAddress.trim().toLowerCase();
    const pref = await this.ensurePreference(email, { consent: true, source });
    // A fresh explicit opt-in overrides an earlier unsubscribe.
    if (!pref.consent || pref.unsubscribedAt) {
      await this.prisma.marketingPreference.update({
        where: { id: pref.id },
        data: { consent: true, unsubscribedAt: null, source },
      });
    }
  }

  /** Public: token lookup for the unsubscribe page. The address is masked ("m***@gmail.com"). */
  async describeToken(token: string): Promise<{ valid: boolean; email?: string; unsubscribed?: boolean }> {
    if (!token || token.length < 16 || token.length > 100) return { valid: false };
    const pref = await this.prisma.marketingPreference.findUnique({ where: { unsubscribeToken: token } });
    if (!pref) return { valid: false };
    return { valid: true, email: maskEmail(pref.email), unsubscribed: !!pref.unsubscribedAt };
  }

  /** Public: unsubscribes (idempotent). The confirmation mail is only sent the first time. */
  async unsubscribe(token: string): Promise<{ valid: boolean; alreadyUnsubscribed: boolean }> {
    if (!token || token.length < 16 || token.length > 100) return { valid: false, alreadyUnsubscribed: false };
    const pref = await this.prisma.marketingPreference.findUnique({ where: { unsubscribeToken: token } });
    if (!pref) return { valid: false, alreadyUnsubscribed: false };
    if (pref.unsubscribedAt) return { valid: true, alreadyUnsubscribed: true };

    await this.prisma.marketingPreference.update({
      where: { id: pref.id },
      data: { unsubscribedAt: new Date(), consent: false, source: 'unsubscribe_link' },
    });
    // Queued campaign mails for this address must not go out anymore (also guarded at send time).
    this.email.sendUnsubscribeConfirmation(pref.email).catch((err) => {
      console.error('[Marketing] Failed to send unsubscribe confirmation:', err);
    });
    return { valid: true, alreadyUnsubscribed: false };
  }

  unsubscribeUrl(token: string, locale?: string | null): string {
    const prefix = locale && locale !== 'de' ? `/${locale}` : '';
    return `${this.config.siteUrl}${prefix}/abmelden?token=${encodeURIComponent(token)}`;
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Customer directory                                          *
   * ──────────────────────────────────────────────────────────── */

  /** Every customer (booking or inquiry) deduplicated by e-mail, with the eligibility computed. */
  async loadCustomers(): Promise<CustomerRecord[]> {
    const [bookings, inquiries, prefs] = await Promise.all([
      this.prisma.booking.findMany({
        where: { customerEmail: { not: null } },
        select: {
          customerEmail: true,
          customerName: true,
          customerPhone: true,
          customerLocale: true,
          status: true,
          startDate: true,
          endDate: true,
          createdAt: true,
        },
      }),
      this.prisma.contactRequest.findMany({
        select: { email: true, fullName: true, phone: true, marketingConsent: true, locale: true, createdAt: true },
      }),
      this.prisma.marketingPreference.findMany(),
    ]);

    type Acc = CustomerRecord & { nameAt: number; phoneAt: number; localeAt: number };
    const byEmail = new Map<string, Acc>();
    const get = (raw: string): Acc => {
      const email = raw.trim().toLowerCase();
      let acc = byEmail.get(email);
      if (!acc) {
        acc = {
          email,
          name: '',
          phone: null,
          locale: null,
          bookingsCount: 0,
          inquiriesCount: 0,
          lastRentalAt: null,
          lastActivityAt: null,
          marketingConsent: false,
          unsubscribed: false,
          eligible: false,
          nameAt: 0,
          phoneAt: 0,
          localeAt: 0,
        };
        byEmail.set(email, acc);
      }
      return acc;
    };
    const touch = (acc: Acc, at: Date) => {
      if (!acc.lastActivityAt || at > acc.lastActivityAt) acc.lastActivityAt = at;
    };
    const latest = (acc: Acc, key: 'name' | 'phone' | 'locale', value: string | null | undefined, at: Date) => {
      const atKey = `${key}At` as 'nameAt' | 'phoneAt' | 'localeAt';
      if (value && value.trim() && at.getTime() >= acc[atKey]) {
        (acc as unknown as Record<string, unknown>)[key] = value.trim();
        acc[atKey] = at.getTime();
      }
    };

    for (const b of bookings) {
      if (!b.customerEmail) continue;
      const acc = get(b.customerEmail);
      latest(acc, 'name', b.customerName, b.createdAt);
      latest(acc, 'phone', b.customerPhone, b.createdAt);
      latest(acc, 'locale', b.customerLocale, b.createdAt);
      touch(acc, b.createdAt);
      if (b.status !== 'cancelled') {
        acc.bookingsCount++;
        if (!acc.lastRentalAt || b.endDate > acc.lastRentalAt) acc.lastRentalAt = b.endDate;
      }
    }
    for (const i of inquiries) {
      const acc = get(i.email);
      latest(acc, 'name', i.fullName, i.createdAt);
      latest(acc, 'phone', i.phone, i.createdAt);
      latest(acc, 'locale', i.locale, i.createdAt);
      touch(acc, i.createdAt);
      acc.inquiriesCount++;
      if (i.marketingConsent) acc.marketingConsent = true;
    }
    for (const pref of prefs) {
      const acc = get(pref.email);
      if (pref.consent) acc.marketingConsent = true;
      if (pref.unsubscribedAt) acc.unsubscribed = true;
    }

    return Array.from(byEmail.values()).map(({ nameAt, phoneAt, localeAt, ...rest }) => {
      void nameAt; void phoneAt; void localeAt;
      return { ...rest, eligible: (rest.marketingConsent || rest.bookingsCount > 0) && !rest.unsubscribed };
    });
  }

  async listCustomers(options: { q?: string; filter?: CustomerFilter; page?: number; pageSize?: number }) {
    const all = await this.loadCustomers();
    const counts = {
      all: all.length,
      eligible: all.filter((c) => c.eligible).length,
      consent: all.filter((c) => c.marketingConsent && !c.unsubscribed).length,
      customers: all.filter((c) => c.bookingsCount > 0).length,
      unsubscribed: all.filter((c) => c.unsubscribed).length,
    };

    const q = options.q?.trim().toLowerCase();
    const filter = options.filter ?? 'all';
    let rows = all.filter((c) => {
      if (q && !(c.email.includes(q) || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q))) return false;
      switch (filter) {
        case 'eligible': return c.eligible;
        case 'consent': return c.marketingConsent && !c.unsubscribed;
        case 'customers': return c.bookingsCount > 0;
        case 'unsubscribed': return c.unsubscribed;
        default: return true;
      }
    });
    rows = rows.sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0));

    const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 500);
    const page = Math.max(options.page ?? 1, 1);
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
      counts,
    };
  }

  /* ──────────────────────────────────────────────────────────── *
   *  Campaigns                                                   *
   * ──────────────────────────────────────────────────────────── */

  /** Resolves the recipients of a request: eligible only, deduplicated, with the skipped addresses. */
  async resolveRecipients(recipients: CreateCampaignInput['recipients']) {
    const customers = await this.loadCustomers();
    const eligible = customers.filter((c) => c.eligible);
    if (recipients.mode === 'all') return { recipients: eligible, skipped: [] as string[] };

    const wanted = Array.from(new Set(recipients.emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
    const byEmail = new Map(eligible.map((c) => [c.email, c]));
    const picked: CustomerRecord[] = [];
    const skipped: string[] = [];
    for (const email of wanted) {
      const c = byEmail.get(email);
      if (c) picked.push(c);
      else skipped.push(email);
    }
    return { recipients: picked, skipped };
  }

  /** Validates the code part of a campaign request; returns the shared code to use/create (if any). */
  private assertCodeInput(input: CreateCampaignInput): void {
    if (input.codeMode === 'NONE') return;
    const code = input.code;
    if (!code) throw new AppError('Für diese Kampagne wird ein Rabattcode benötigt.', 422, 'code_required');
    const hasExisting = input.codeMode === 'SHARED' && !!code.id;
    if (!hasExisting) {
      if (!code.type || code.value === undefined || !(code.value > 0)) {
        throw new AppError('Bitte Rabattart und Wert angeben.', 422, 'code_required');
      }
      if (code.type === 'PERCENT' && code.value > 100) {
        throw new AppError('Ein Prozentrabatt kann höchstens 100 % betragen.', 422, 'code_invalid');
      }
    }
  }

  /** Sample of what a recipient will receive (used by the preview endpoint). */
  async previewCampaign(input: CreateCampaignInput) {
    this.assertCodeInput(input);
    const { recipients, skipped } = await this.resolveRecipients(input.recipients);
    let discountText: string | null = null;
    let sampleCode: string | null = null;
    let validUntil: Date | null = null;
    if (input.codeMode !== 'NONE' && input.code) {
      if (input.code.id) {
        const existing = await this.prisma.discountCode.findUnique({ where: { id: input.code.id } });
        if (!existing) throw new AppError('Rabattcode nicht gefunden.', 404, 'not_found');
        discountText = DiscountService.describe(existing);
        sampleCode = existing.code;
        validUntil = existing.validUntil;
      } else if (input.code.type && input.code.value) {
        discountText = DiscountService.describe({
          type: input.code.type,
          value: input.code.value as unknown as Prisma.Decimal,
          currency: input.code.currency ?? null,
        });
        sampleCode = input.codeMode === 'PERSONAL' ? 'HD-XXXX-XXXX' : input.code.code ?? 'HD-XXXX-XXXX';
        validUntil = input.code.validUntil ?? null;
      }
    }
    return {
      recipientCount: recipients.length,
      skipped,
      sampleCode,
      discountText,
      validUntil,
      sampleRecipient: recipients[0] ? { email: recipients[0].email, name: recipients[0].name } : null,
    };
  }

  async createCampaign(input: CreateCampaignInput, adminId: string) {
    this.assertCodeInput(input);
    const { recipients, skipped } = await this.resolveRecipients(input.recipients);
    if (recipients.length === 0) {
      throw new AppError('Es gibt keine berechtigten Empfänger für diese Kampagne.', 422, 'no_recipients', undefined, {
        recipients: ['Keine berechtigten Empfänger.'],
      });
    }
    if (recipients.length > MAX_CAMPAIGN_RECIPIENTS) {
      throw new AppError(
        `Eine Kampagne kann höchstens ${MAX_CAMPAIGN_RECIPIENTS} Empfänger haben (aktuell ${recipients.length}).`,
        422,
        'too_many_recipients',
      );
    }

    // Unsubscribe tokens exist for everyone before the mails are built.
    const prefs = new Map<string, MarketingPreference>();
    for (const r of recipients) prefs.set(r.email, await this.ensurePreference(r.email, { consent: r.marketingConsent }));

    type RecipientPlan = { id: string; customer: CustomerRecord; codeId: string | null; code: string | null };
    const plans: RecipientPlan[] = [];
    let campaignId = '';
    let sharedCode: { id: string; code: string; discountText: string; validUntil: Date | null } | null = null;

    await this.prisma.$transaction(
      async (tx) => {
        const campaign = await tx.marketingCampaign.create({
          data: {
            subject: input.subject.trim(),
            message: input.message.trim(),
            codeMode: input.codeMode,
            createdById: adminId,
          },
        });
        campaignId = campaign.id;

        const template = input.code;
        if (input.codeMode === 'SHARED' && template) {
          if (template.id) {
            const existing = await tx.discountCode.findUnique({ where: { id: template.id } });
            if (!existing) throw new AppError('Rabattcode nicht gefunden.', 404, 'not_found');
            if (!existing.active) throw new AppError('Der gewählte Rabattcode ist nicht aktiv.', 422, 'code_inactive');
            sharedCode = {
              id: existing.id,
              code: existing.code,
              discountText: DiscountService.describe(existing),
              validUntil: existing.validUntil,
            };
          } else {
            const codeText = template.code ? this.cleanCode(template.code) : await this.discounts.uniqueCode(tx);
            if (await tx.discountCode.findUnique({ where: { code: codeText }, select: { id: true } })) {
              throw new AppError('Dieser Rabattcode existiert bereits.', 409, 'code_taken');
            }
            const created = await tx.discountCode.create({
              data: {
                code: codeText,
                label: template.label ?? `Kampagne: ${input.subject.trim()}`.slice(0, 120),
                type: template.type!,
                value: template.value!,
                currency: template.type === 'FIXED' ? (template.currency ?? 'CHF') : null,
                validFrom: template.validFrom ?? null,
                validUntil: template.validUntil ?? null,
                minDays: template.minDays ?? null,
                maxRedemptions: template.maxRedemptions ?? null,
                perEmailLimit: template.perEmailLimit ?? 1,
                campaignId: campaign.id,
                createdById: adminId,
              },
            });
            sharedCode = {
              id: created.id,
              code: created.code,
              discountText: DiscountService.describe(created),
              validUntil: created.validUntil,
            };
          }
        }

        for (const customer of recipients) {
          let codeId: string | null = sharedCode?.id ?? null;
          let codeText: string | null = sharedCode?.code ?? null;
          if (input.codeMode === 'PERSONAL' && template) {
            codeText = await this.discounts.uniqueCode(tx);
            const personal = await tx.discountCode.create({
              data: {
                code: codeText,
                label: `Kampagne: ${input.subject.trim()}`.slice(0, 120),
                type: template.type!,
                value: template.value!,
                currency: template.type === 'FIXED' ? (template.currency ?? 'CHF') : null,
                validFrom: template.validFrom ?? null,
                validUntil: template.validUntil ?? null,
                minDays: template.minDays ?? null,
                // A personal code works once, for this address only.
                maxRedemptions: 1,
                perEmailLimit: 1,
                recipientEmail: customer.email,
                campaignId: campaign.id,
                createdById: adminId,
              },
            });
            codeId = personal.id;
          }
          const recipient = await tx.marketingRecipient.create({
            data: { campaignId: campaign.id, email: customer.email, name: customer.name, codeId, status: 'QUEUED' },
          });
          plans.push({ id: recipient.id, customer, codeId, code: codeText });
        }
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    // Queue one mail per recipient. The outbox worker sends them in small batches.
    const personalTemplate = input.codeMode === 'PERSONAL' ? input.code : undefined;
    for (const plan of plans) {
      try {
        const pref = prefs.get(plan.customer.email)!;
        const result = await this.email.sendDiscountCampaign({
          to: plan.customer.email,
          recipientName: plan.customer.name || null,
          subject: input.subject.trim(),
          message: input.message.trim(),
          code: plan.code,
          discountText: sharedCode
            ? (sharedCode as { discountText: string }).discountText
            : personalTemplate
              ? DiscountService.describe({
                  type: personalTemplate.type!,
                  value: personalTemplate.value as unknown as Prisma.Decimal,
                  currency: personalTemplate.currency ?? 'CHF',
                })
              : null,
          validUntil: sharedCode ? (sharedCode as { validUntil: Date | null }).validUntil : (personalTemplate?.validUntil ?? null),
          unsubscribeUrl: this.unsubscribeUrl(pref.unsubscribeToken, plan.customer.locale),
          related: { type: RECIPIENT_RELATED, id: plan.id },
        });
        await this.prisma.marketingRecipient.update({ where: { id: plan.id }, data: { emailMessageId: result.id } });
      } catch (err) {
        await this.prisma.marketingRecipient.update({
          where: { id: plan.id },
          data: { status: 'FAILED', error: err instanceof Error ? err.message.slice(0, 500) : 'Fehler beim Einreihen' },
        });
      }
    }

    // All recipients may have failed to queue: close the campaign then.
    const open = await this.prisma.marketingRecipient.count({ where: { campaignId, status: 'QUEUED' } });
    if (open === 0) await this.prisma.marketingCampaign.update({ where: { id: campaignId }, data: { sentAt: new Date() } });

    return { campaign: await this.getCampaign(campaignId), skipped };
  }

  private cleanCode(raw: string): string {
    const code = raw.trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
      throw new AppError('Der Code darf nur Buchstaben, Ziffern, - und _ enthalten (3-32 Zeichen).', 422, 'code_invalid');
    }
    return code;
  }

  async listCampaigns(options: { page?: number; pageSize?: number }) {
    const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);
    const page = Math.max(options.page ?? 1, 1);
    const [rows, total] = await Promise.all([
      this.prisma.marketingCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { createdBy: { select: { id: true, name: true } } },
      }),
      this.prisma.marketingCampaign.count(),
    ]);
    const items = [];
    for (const c of rows) items.push(await this.toCampaignDto(c, false));
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async getCampaign(id: string) {
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!campaign) throw new AppError('Kampagne nicht gefunden.', 404, 'not_found');
    return this.toCampaignDto(campaign, true);
  }

  private async toCampaignDto(
    c: Prisma.MarketingCampaignGetPayload<{ include: { createdBy: { select: { id: true; name: true } } } }>,
    withRecipients: boolean,
  ) {
    const groups = await this.prisma.marketingRecipient.groupBy({
      by: ['status'],
      where: { campaignId: c.id },
      _count: { _all: true },
    });
    const count = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
    const codes = await this.prisma.discountCode.findMany({
      where: { campaignId: c.id },
      select: { id: true, code: true, type: true, value: true, currency: true, recipientEmail: true },
      take: 1,
    });
    const redemptions = await this.prisma.discountRedemption.count({ where: { code: { campaignId: c.id } } });

    const recipients = withRecipients
      ? (
          await this.prisma.marketingRecipient.findMany({
            where: { campaignId: c.id },
            orderBy: [{ status: 'asc' }, { email: 'asc' }],
            include: { code: { select: { code: true } } },
          })
        ).map((r) => ({
          id: r.id,
          email: r.email,
          name: r.name,
          status: r.status,
          error: r.error,
          code: r.code?.code ?? null,
          sentAt: r.sentAt,
          emailMessageId: r.emailMessageId,
        }))
      : undefined;

    return {
      id: c.id,
      subject: c.subject,
      message: c.message,
      codeMode: c.codeMode,
      createdAt: c.createdAt,
      sentAt: c.sentAt,
      createdBy: c.createdBy ? { id: c.createdBy.id, name: c.createdBy.name } : null,
      counts: {
        total: count('QUEUED') + count('SENT') + count('FAILED'),
        queued: count('QUEUED'),
        sent: count('SENT'),
        failed: count('FAILED'),
      },
      redemptions,
      /** For SHARED campaigns the one shared code; for PERSONAL a sample (type / value). */
      code: codes[0]
        ? {
            id: codes[0].id,
            code: c.codeMode === 'SHARED' ? codes[0].code : null,
            type: codes[0].type,
            value: Number(codes[0].value),
            currency: codes[0].currency,
          }
        : null,
      ...(recipients ? { recipients } : {}),
    };
  }
}

/** "max.muster@gmail.com" -> "m***@gmail.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}
