export type FuelType = 'petrol' | 'diesel' | 'electric' | 'hybrid';
export type TransmissionType = 'automatic' | 'manual';

/**
 * VehicleSpecs Value Object – encapsulates technical details.
 */
export class VehicleSpecs {
  private constructor(
    public readonly horsepower: number,
    public readonly transmission: TransmissionType,
    public readonly seats: number,
    public readonly fuelType: FuelType,
    public readonly range?: string,
  ) {}

  static create(props: {
    horsepower: number;
    transmission: TransmissionType;
    seats: number;
    fuelType: FuelType;
    range?: string;
  }): VehicleSpecs {
    if (props.horsepower < 0) {
      throw new Error('Horsepower cannot be negative');
    }
    if (props.seats < 1 || props.seats > 12) {
      throw new Error('Seats must be between 1 and 12');
    }
    return new VehicleSpecs(
      props.horsepower,
      props.transmission,
      props.seats,
      props.fuelType,
      props.range,
    );
  }

  toSpecsList(): string[] {
    const specs: string[] = [];
    if (this.fuelType === 'electric') {
      specs.push('Electric');
    } else {
      specs.push(`${this.horsepower} HP`);
    }
    specs.push(this.transmission === 'automatic' ? 'Automatic' : 'Manual');
    specs.push(`${this.seats} Seats`);
    specs.push(this.fuelType.charAt(0).toUpperCase() + this.fuelType.slice(1));
    if (this.range) specs.push(this.range);
    return specs;
  }
}
