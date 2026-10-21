/**
 * Records marketing opt-ins (e.g. the checkbox in the inquiry form) so the marketing module knows who
 * may be mailed. Implemented by MarketingService.
 */
export interface IMarketingConsent {
  /** The address gave explicit consent (opt-in). Clears an earlier unsubscribe. */
  recordOptIn(email: string, source: 'contact_form' | 'admin'): Promise<void>;
}
