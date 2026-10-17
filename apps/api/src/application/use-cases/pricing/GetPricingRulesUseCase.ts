import { type PricingRule, type IPricingRuleRepository } from '../../../domain';

export class GetPricingRulesUseCase {
  constructor(private pricingRuleRepo: IPricingRuleRepository) {}

  execute(): Promise<PricingRule[]> {
    return this.pricingRuleRepo.findAll();
  }
}
