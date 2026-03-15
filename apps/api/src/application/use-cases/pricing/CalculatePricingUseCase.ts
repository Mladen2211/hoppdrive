import {
  PricingService,
  type IVehicleRepository,
  type IPricingRuleRepository,
  type PricingResult,
} from '../../../domain';

interface CalculatePricingInput {
  vehicleId: string;
  totalDays: number;
}

export class CalculatePricingUseCase {
  constructor(
    private vehicleRepo: IVehicleRepository,
    private pricingRuleRepo: IPricingRuleRepository,
  ) {}

  async execute(input: CalculatePricingInput): Promise<PricingResult> {
    const vehicle = await this.vehicleRepo.findById(input.vehicleId);
    if (!vehicle) {
      throw new Error(`Vehicle ${input.vehicleId} not found`);
    }

    const rules = await this.pricingRuleRepo.findAll();
    return PricingService.calculate(vehicle.basePricePerDay, input.totalDays, rules);
  }
}
