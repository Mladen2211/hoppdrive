import { Money } from '../value-objects/Money';
import { PricingRule } from '../entities/PricingRule';

export interface PricingResult {
  baseDaily: Money;
  effectiveDaily: Money;
  totalDays: number;
  totalPrice: Money;
  discountPercent: number;
}

/**
 * Domain Service: Encapsulates the dynamic pricing calculation logic.
 * This is a pure domain service with no external dependencies.
 */
export class PricingService {
  /**
   * Calculate the total rental price based on duration and pricing rules.
   * Applies tiered discounts according to the configured breakpoints.
   */
  static calculate(
    basePricePerDay: Money,
    totalDays: number,
    rules: PricingRule[],
  ): PricingResult {
    if (totalDays < 1) {
      throw new Error('Rental must be at least 1 day');
    }

    // Sort rules by fromDay ascending
    const sortedRules = [...rules].sort((a, b) => a.fromDay - b.fromDay);

    // Calculate the total price day-by-day using tiered pricing
    let totalAmount = 0;
    let lastAppliedDiscount = 0;

    for (let day = 1; day <= totalDays; day++) {
      const rule = sortedRules.find((r) => r.appliesTo(day));
      const discount = rule?.discountPercent ?? 0;
      lastAppliedDiscount = discount;
      const dayPrice = basePricePerDay.applyDiscount(discount);
      totalAmount += dayPrice.amount;
    }

    const totalPrice = Money.create(totalAmount, basePricePerDay.currency);
    const effectiveDaily = Money.create(
      totalAmount / totalDays,
      basePricePerDay.currency,
    );

    return {
      baseDaily: basePricePerDay,
      effectiveDaily,
      totalDays,
      totalPrice,
      discountPercent: lastAppliedDiscount,
    };
  }
}
