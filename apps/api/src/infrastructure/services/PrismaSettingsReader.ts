import { PrismaClient } from '@prisma/client';
import type {
  ISettingsReader,
  InquiryNotificationSettings,
} from '../../application/interfaces/ISettingsReader';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class PrismaSettingsReader implements ISettingsReader {
  constructor(private prisma: PrismaClient) {}

  async getCurrencyCode(): Promise<string> {
    try {
      const row = await this.prisma.siteSetting.findUnique({ where: { key: 'currency' } });
      const code = (row?.value as { code?: unknown } | null)?.code;
      return code === 'EUR' ? 'EUR' : 'CHF';
    } catch {
      return 'CHF';
    }
  }

  async getInquiryNotificationSettings(): Promise<InquiryNotificationSettings> {
    try {
      const rows = await this.prisma.siteSetting.findMany({
        where: { key: { in: ['notifications', 'company'] } },
      });
      const byKey = new Map(rows.map((r) => [r.key, r.value as Record<string, unknown> | null]));

      const notifications = byKey.get('notifications');
      const company = byKey.get('company');

      // Only an explicit `false` disables the mail; a missing key keeps today's behaviour.
      const enabled = notifications?.emailOnInquiry !== false;

      const raw = typeof company?.inquiryEmail === 'string' ? company.inquiryEmail.trim() : '';
      const recipient = raw && EMAIL_RE.test(raw) ? raw : undefined;

      return { enabled, recipient };
    } catch (err) {
      // Settings must never block an inquiry: fall back to the defaults.
      console.error('[Settings] Failed to read inquiry notification settings:', err);
      return { enabled: true };
    }
  }
}
