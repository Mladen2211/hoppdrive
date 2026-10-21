import { randomInt } from 'crypto';
import type { DiscountCode, Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export type DiscountReason =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'exhausted'
  | 'email_limit'
  | 'min_days'
  | 'wrong_recipient'
  | 'email_required'
  | 'currency_mismatch';

/** German texts for the admin; the website shows its own translation per `reason`. */
export const DISCOUNT_REASON_MESSAGES: Record<DiscountReason, string> = {
  not_found: 'Dieser Code ist ungültig.',
  inactive: 'Dieser Code ist nicht mehr aktiv.',
  not_started: 'Dieser Code ist noch nicht gültig.',
  expired: 'Dieser Code ist abgelaufen.',
  exhausted: 'Dieser Code wurde bereits zu oft eingelöst.',
  email_limit: 'Dieser Code wurde mit dieser E-Mail-Adresse bereits eingelöst.',
  min_days: 'Dieser Code gilt erst ab einer längeren Mietdauer.',
  wrong_recipient: 'Dieser Code ist für eine andere E-Mail-Adresse bestimmt.',
  email_required: 'Bitte geben Sie Ihre E-Mail-Adresse an, damit wir den Code prüfen können.',
  currency_mismatch: 'Dieser Code gilt nicht für die aktuelle Währung.',
};

export interface DiscountCheckInput {
  code: string;
  /** Address of the customer (personal codes and the per-email limit need it). */
  email?: string | null;
  /** Rental length in days. */
  days: number;
  /** Rental price before the discount. */
  baseTotal: number;
  currency: string;
  now?: Date;
}

export interface DiscountCheck {
  valid: boolean;
  reason?: DiscountReason;
  message?: string;
  code?: DiscountCode;
  /** Amount deducted from baseTotal (0 when invalid). */
  discount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Upper case, no spaces: "hd-ab12 cd34" -> "HD-AB12CD34". */
export function normalizeDiscountCode(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export const DISCOUNT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

// Without 0/O/1/I/L so personal codes survive being read aloud or retyped.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** HD-XXXX-XXXX */
export function generateDiscountCode(): string {
  const part = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
  return `HD-${part()}-${part()}`;
}

/**
 * Discount code rules in one place: validity window, active flag, redemption limits, minimum rental
 * days, personal (recipient-only) codes, and the discount amount (PERCENT or FIXED, never more than
 * the price). Used by the public validation endpoint, the inquiry approval and the booking creation.
 */
export class DiscountService {
  constructor(private prisma: PrismaClient) {}

  /** Redemptions that still count: bookings that were cancelled give the redemption back. */
  private async countRedemptions(db: Db, codeId: string, email?: string): Promise<number> {
    return db.discountRedemption.count({
      where: {
        codeId,
        ...(email ? { email } : {}),
        OR: [{ bookingId: null }, { booking: { status: { not: 'cancelled' } } }],
      },
    });
  }

  async check(input: DiscountCheckInput, db: Db = this.prisma): Promise<DiscountCheck> {
    const fail = (reason: DiscountReason, code?: DiscountCode): DiscountCheck => ({
      valid: false,
      reason,
      message: DISCOUNT_REASON_MESSAGES[reason],
      code,
      discount: 0,
    });

    const normalised = normalizeDiscountCode(input.code);
    if (!normalised) return fail('not_found');
    const code = await db.discountCode.findUnique({ where: { code: normalised } });
    if (!code) return fail('not_found');
    if (!code.active) return fail('inactive', code);

    const now = input.now ?? new Date();
    if (code.validFrom && now < code.validFrom) return fail('not_started', code);
    if (code.validUntil && now > code.validUntil) return fail('expired', code);

    const email = input.email?.trim().toLowerCase() || null;
    if (code.recipientEmail) {
      if (!email) return fail('email_required', code);
      if (code.recipientEmail.toLowerCase() !== email) return fail('wrong_recipient', code);
    }
    if (code.minDays && input.days < code.minDays) return fail('min_days', code);
    if (code.type === 'FIXED' && code.currency && code.currency.toUpperCase() !== input.currency.toUpperCase()) {
      return fail('currency_mismatch', code);
    }
    if (code.maxRedemptions !== null && (await this.countRedemptions(db, code.id)) >= code.maxRedemptions) {
      return fail('exhausted', code);
    }
    if (email && (await this.countRedemptions(db, code.id, email)) >= code.perEmailLimit) {
      return fail('email_limit', code);
    }

    return { valid: true, code, discount: DiscountService.computeAmount(code, input.baseTotal) };
  }

  /** PERCENT of the price or the FIXED amount, never more than the price itself. */
  static computeAmount(code: Pick<DiscountCode, 'type' | 'value'>, baseTotal: number): number {
    const value = Number(code.value);
    const raw = code.type === 'PERCENT' ? (baseTotal * value) / 100 : value;
    return Math.max(0, Math.min(round2(raw), round2(baseTotal)));
  }

  /** Records a redemption. Call inside the same (serializable) transaction as the check. */
  async redeem(
    db: Db,
    input: { codeId: string; email: string; amount: number; bookingId?: string; contactRequestId?: string },
  ): Promise<void> {
    await db.discountRedemption.create({
      data: {
        codeId: input.codeId,
        email: input.email.trim().toLowerCase(),
        amount: input.amount,
        bookingId: input.bookingId ?? null,
        contactRequestId: input.contactRequestId ?? null,
      },
    });
  }

  /** Generates a code that does not exist yet. */
  async uniqueCode(db: Db = this.prisma): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const candidate = generateDiscountCode();
      if (!(await db.discountCode.findUnique({ where: { code: candidate }, select: { id: true } }))) return candidate;
    }
    throw new Error('Could not generate a unique discount code');
  }

  /** "20 %" or "CHF 30.00" for e-mails and lists. */
  static describe(code: Pick<DiscountCode, 'type' | 'value' | 'currency'>, fallbackCurrency = 'CHF'): string {
    const value = Number(code.value);
    return code.type === 'PERCENT'
      ? `${Number.isInteger(value) ? value : value.toFixed(1)} %`
      : `${code.currency || fallbackCurrency} ${value.toFixed(2)}`;
  }

  /** Derived state for the admin list. */
  static status(
    code: Pick<DiscountCode, 'active' | 'validFrom' | 'validUntil' | 'maxRedemptions'>,
    redemptions: number,
    now = new Date(),
  ): 'active' | 'inactive' | 'scheduled' | 'expired' | 'exhausted' {
    if (!code.active) return 'inactive';
    if (code.validUntil && now > code.validUntil) return 'expired';
    if (code.validFrom && now < code.validFrom) return 'scheduled';
    if (code.maxRedemptions !== null && redemptions >= code.maxRedemptions) return 'exhausted';
    return 'active';
  }
}
