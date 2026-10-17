import { PricingRule, type IPricingRuleRepository } from '../../../domain';

interface UpdatePricingRuleInput {
  id: string;
  fromDay: number;
  toDay: number | null;
  discountPercent: number;
}

export class UpdatePricingRuleUseCase {
  constructor(private pricingRuleRepo: IPricingRuleRepository) {}

  execute(input: UpdatePricingRuleInput): Promise<PricingRule> {
    const rule = PricingRule.create(input);
    return this.pricingRuleRepo.update(rule);
  }
}
