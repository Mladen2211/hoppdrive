import { Entity } from './Entity';
import { Money } from '../value-objects/Money';
import { VehicleSpecs } from '../value-objects/VehicleSpecs';

export type VehicleType =
  | 'sedan'
  | 'suv'
  | 'estate'
  | 'coupe'
  | 'convertible'
  | 'electric'
  | 'van';

export interface VehicleImage {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface VehicleProps {
  id: string;
  brand: string;
  model: string;
  type: VehicleType;
  year: number;
  basePricePerDay: Money;
  specs: VehicleSpecs;
  images: VehicleImage[];
  isAvailable: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Vehicle extends Entity {
  public brand: string;
  public model: string;
  public type: VehicleType;
  public year: number;
  public basePricePerDay: Money;
  public specs: VehicleSpecs;
  public images: VehicleImage[];
  public isAvailable: boolean;

  private constructor(props: VehicleProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.brand = props.brand;
    this.model = props.model;
    this.type = props.type;
    this.year = props.year;
    this.basePricePerDay = props.basePricePerDay;
    this.specs = props.specs;
    this.images = props.images;
    this.isAvailable = props.isAvailable;
  }

  static create(props: VehicleProps): Vehicle {
    if (!props.brand || props.brand.trim().length === 0) {
      throw new Error('Vehicle brand is required');
    }
    if (!props.model || props.model.trim().length === 0) {
      throw new Error('Vehicle model is required');
    }
    if (props.year < 1900 || props.year > new Date().getFullYear() + 2) {
      throw new Error('Vehicle year is invalid');
    }
    return new Vehicle(props);
  }

  get displayName(): string {
    return `${this.brand} ${this.model}`;
  }

  get thumbnailUrl(): string | null {
    const primary = this.images.find((img) => img.isPrimary);
    return primary?.url ?? this.images[0]?.url ?? null;
  }

  markUnavailable(): void {
    this.isAvailable = false;
    this.updatedAt = new Date();
  }

  markAvailable(): void {
    this.isAvailable = true;
    this.updatedAt = new Date();
  }

  updateDetails(
    partial: Partial<Pick<VehicleProps, 'brand' | 'model' | 'type' | 'year' | 'basePricePerDay' | 'specs'>>,
  ): void {
    if (partial.brand !== undefined) this.brand = partial.brand;
    if (partial.model !== undefined) this.model = partial.model;
    if (partial.type !== undefined) this.type = partial.type;
    if (partial.year !== undefined) this.year = partial.year;
    if (partial.basePricePerDay !== undefined) this.basePricePerDay = partial.basePricePerDay;
    if (partial.specs !== undefined) this.specs = partial.specs;
    this.updatedAt = new Date();
  }

  addImage(image: VehicleImage): void {
    this.images.push(image);
    this.updatedAt = new Date();
  }

  removeImage(imageId: string): void {
    this.images = this.images.filter((img) => img.id !== imageId);
    this.updatedAt = new Date();
  }

  setPrimaryImage(imageId: string): void {
    this.images = this.images.map((img) => ({
      ...img,
      isPrimary: img.id === imageId,
    }));
    this.updatedAt = new Date();
  }
}
