import { PrismaClient, PricingRule as PrismaPricingRule } from '@prisma/client';
import { PricingRule, type IPricingRuleRepository } from '../../../domain';

export class PrismaPricingRuleRepository implements IPricingRuleRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<PricingRule[]> {
    const rows = await this.prisma.pricingRule.findMany({
      orderBy: { fromDay: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async save(rule: PricingRule): Promise<PricingRule> {
    const row = await this.prisma.pricingRule.create({
      data: {
        id: rule.id,
        fromDay: rule.fromDay,
        toDay: rule.toDay,
        discountPercent: rule.discountPercent,
      },
    });
    return this.toDomain(row);
  }

  async update(rule: PricingRule): Promise<PricingRule> {
    const row = await this.prisma.pricingRule.update({
      where: { id: rule.id },
      data: {
        fromDay: rule.fromDay,
        toDay: rule.toDay,
        discountPercent: rule.discountPercent,
      },
    });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.pricingRule.delete({ where: { id } });
  }

  async deleteAll(): Promise<void> {
    await this.prisma.pricingRule.deleteMany();
  }

  private toDomain(row: PrismaPricingRule): PricingRule {
    return PricingRule.create({
      id: row.id,
      fromDay: row.fromDay,
      toDay: row.toDay,
      discountPercent: Number(row.discountPercent),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
