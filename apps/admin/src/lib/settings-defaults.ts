/**
 * Types and defaults of the site settings edited on the "Website" tab (key/value pairs behind
 * GET /settings and PUT /settings/:key). Defaults are used on fresh installs where a key is missing.
 */
import { tr } from '@/i18n/active';

export interface PricingTierCopy {
  number: string;
  title: string;
  description: string;
  badge: string;
}

export interface PricingCopy {
  visible: boolean;
  title: string;
  tiers: PricingTierCopy[];
  /** { en: { title, tiers: [{ title, description, badge }] }, ... }; German lives in the fields above. */
  i18n?: Record<string, unknown>;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface FeaturesSetting {
  visible: boolean;
  items: FeatureItem[];
  /** { en: { items: [{ title, description }] }, ... } */
  i18n?: Record<string, unknown>;
}

export interface LocationSetting {
  visible: boolean;
  title: string;
  address: string;
  lat: number;
  lng: number;
  zoom: number;
  /** { en: { title }, ... } */
  i18n?: Record<string, unknown>;
}

export interface SeoSetting {
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
}

export interface InvoiceSettings {
  uid: string;
  iban: string;
  bankName: string;
  vatRate: number;
  /** QR-IBAN (Swiss IBAN with institution ID 30000-31999); QR bills then carry a QRR reference. */
  qrIban: string;
  /** Payment term in days. */
  dueDays: number;
  /** Default of the "Mit QR-Rechnung" checkbox when creating an invoice. */
  defaultWithQrBill: boolean;
}

export interface CompanyForm {
  name: string;
  phone: string;
  inquiryEmail: string;
  /** Address of the company (contracts, invoices, QR bill creditor, e-mail footer). */
  street: string;
  zip: string;
  city: string;
  country: string;
  /** UID / VAT number */
  uid: string;
}

export interface MaintenanceForm {
  enabled: boolean;
  message: string;
}

export const DEFAULT_PRICING: PricingCopy = {
  visible: true,
  title: 'So funktioniert unsere Preisgestaltung',
  tiers: [
    { number: '01', title: 'Tag 1 – 7', description: 'Standard-Tagestarif für kurzfristige Bedürfnisse.', badge: '' },
    { number: '02', title: 'Tag 8 – 30', description: 'Automatisch 20% Rabatt auf den Tagestarif bei verlängerter Miete.', badge: '20% RABATT' },
    { number: '03', title: 'Ab 31 Tagen', description: 'Maximaler 40% Rabatt. Bestes Preis-Leistungs-Verhältnis für echte Langzeitmobilität.', badge: '40% RABATT' },
  ],
};

export const ICON_OPTIONS = ['shield', 'clock', 'car', 'zap', 'heart', 'star', 'check-circle', 'truck'];

/** Display names for the icon keys (the stored value stays the key). */
export const ICON_LABELS: Record<string, string> = {
  get shield() { return tr('settings.icons.shield'); },
  get clock() { return tr('settings.icons.clock'); },
  get car() { return tr('settings.icons.car'); },
  get zap() { return tr('settings.icons.zap'); },
  get heart() { return tr('settings.icons.heart'); },
  get star() { return tr('settings.icons.star'); },
  get 'check-circle'() { return tr('settings.icons.checkCircle'); },
  get truck() { return tr('settings.icons.truck'); },
};

export const DEFAULT_FEATURES: FeaturesSetting = {
  visible: true,
  items: [
    { icon: 'shield', title: 'Vollkasko inklusive', description: 'Premium-Versicherungsschutz ohne Zusatzkosten' },
    { icon: 'clock', title: 'Flexible Laufzeiten', description: 'Ab 1 Tag – bis zu 40% Rabatt bei Langzeitmiete' },
    { icon: 'car', title: 'Bestens gewartet', description: 'Jedes Fahrzeug wird vor der Übergabe geprüft' },
  ],
};

export const DEFAULT_LOCATION: LocationSetting = {
  visible: true,
  title: 'Hier finden Sie uns',
  address: 'Musterstrasse 1, 8000 Zürich',
  lat: 47.3769,
  lng: 8.5417,
  zoom: 14,
};

export const DEFAULT_SEO: SeoSetting = {
  metaTitle: '',
  metaDescription: '',
  ogImageUrl: '',
};

export const DEFAULT_INVOICE: InvoiceSettings = {
  uid: '',
  iban: '',
  bankName: '',
  vatRate: 8.1,
  qrIban: '',
  dueDays: 30,
  defaultWithQrBill: false,
};

export const DEFAULT_COMPANY: CompanyForm = { name: '', phone: '', inquiryEmail: '', street: '', zip: '', city: '', country: '', uid: '' };
export const DEFAULT_MAINTENANCE: MaintenanceForm = { enabled: false, message: '' };

/** Recommended lengths shown as counters next to the search-engine fields. */
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

export interface PricingRule {
  id: string;
  fromDay: number;
  toDay: number | null;
  discountPercent: number;
}

/**
 * Overlaps between the day ranges of the pricing rules. Returns, per rule id, a German sentence
 * describing the first problem (range inverted, or overlap with another rule), or nothing when fine.
 */
export function ruleProblems(rules: PricingRule[]): Record<string, string> {
  const problems: Record<string, string> = {};
  const range = (r: PricingRule) => (r.toDay === null ? tr('settings.rangeFrom', { from: r.fromDay }) : tr('settings.rangeBetween', { from: r.fromDay, to: r.toDay }));
  for (const rule of rules) {
    if (rule.toDay !== null && rule.toDay < rule.fromDay) {
      problems[rule.id] = tr('settings.ruleInverted');
    }
  }
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      const aEnd = a.toDay ?? Infinity;
      const bEnd = b.toDay ?? Infinity;
      if (a.fromDay <= bEnd && b.fromDay <= aEnd) {
        problems[a.id] ??= tr('settings.ruleOverlap', { range: range(b) });
        problems[b.id] ??= tr('settings.ruleOverlap', { range: range(a) });
      }
    }
  }
  return problems;
}
