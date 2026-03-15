import { Entity } from './Entity';

export interface PricingRuleProps {
  id: string;
  fromDay: number;
  toDay: number | null; // null means unlimited (e.g., 31+)
  discountPercent: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Represents a pricing breakpoint rule.
 * Days 1-7: 0% discount (base)
 * Days 8-30: 20% off
 * Days 31+: 40% off
 */
export class PricingRule extends Entity {
  public fromDay: number;
  public toDay: number | null;
  public discountPercent: number;

  private constructor(props: PricingRuleProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.fromDay = props.fromDay;
    this.toDay = props.toDay;
    this.discountPercent = props.discountPercent;
  }

  static create(props: PricingRuleProps): PricingRule {
    if (props.fromDay < 1) {
      throw new Error('fromDay must be at least 1');
    }
    if (props.toDay !== null && props.toDay < props.fromDay) {
      throw new Error('toDay must be greater than or equal to fromDay');
    }
    if (props.discountPercent < 0 || props.discountPercent > 100) {
      throw new Error('discountPercent must be between 0 and 100');
    }
    return new PricingRule(props);
  }

  appliesTo(day: number): boolean {
    if (this.toDay === null) {
      return day >= this.fromDay;
    }
    return day >= this.fromDay && day <= this.toDay;
  }
}
