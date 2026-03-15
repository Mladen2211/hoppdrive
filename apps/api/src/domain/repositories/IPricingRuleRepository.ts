import { PricingRule } from '../entities/PricingRule';

export interface IPricingRuleRepository {
  findAll(): Promise<PricingRule[]>;
  save(rule: PricingRule): Promise<PricingRule>;
  update(rule: PricingRule): Promise<PricingRule>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}
