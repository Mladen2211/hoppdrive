import { type IPricingRuleRepository } from '../../../domain';

export class DeletePricingRuleUseCase {
  constructor(private pricingRuleRepo: IPricingRuleRepository) {}

  execute(id: string): Promise<void> {
    return this.pricingRuleRepo.delete(id);
  }
}
