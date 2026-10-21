/**
 * Read access to the CMS key/value settings that influence backend behaviour.
 * Implemented in infrastructure on top of the site_settings table.
 */
export interface InquiryNotificationSettings {
  /** false when Settings → notifications.emailOnInquiry is explicitly switched off. */
  enabled: boolean;
  /** Settings → company.inquiryEmail when set and valid; otherwise undefined (use default address). */
  recipient?: string;
}

export interface ISettingsReader {
  getInquiryNotificationSettings(): Promise<InquiryNotificationSettings>;
  /** Active currency (Settings → Währung); 'CHF' when unset. New vehicles, bookings and invoices use it. */
  getCurrencyCode(): Promise<string>;
}
