/**
 * Evaluates a discount code for a rental (validity window, limits, personal codes, amount).
 * Implemented by DiscountService in infrastructure.
 */
export interface IDiscountPolicy {
  check(input: {
    code: string;
    email?: string | null;
    days: number;
    baseTotal: number;
    currency: string;
  }): Promise<{
    valid: boolean;
    reason?: string;
    message?: string;
    code?: { id: string; code: string };
    /** Amount deducted from baseTotal. */
    discount: number;
  }>;
}
