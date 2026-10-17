import { v4 as uuid } from 'uuid';
import { PricingRule, type IPricingRuleRepository } from '../../../domain';

interface CreatePricingRuleInput {
  fromDay: number;
  toDay: number | null;
  discountPercent: number;
}

export class CreatePricingRuleUseCase {
  constructor(private pricingRuleRepo: IPricingRuleRepository) {}

  execute(input: CreatePricingRuleInput): Promise<PricingRule> {
    const rule = PricingRule.create({ id: uuid(), ...input });
    return this.pricingRuleRepo.save(rule);
  }
}
