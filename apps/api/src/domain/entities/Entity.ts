/**
 * Base Entity class for all domain entities.
 * Provides identity equality and tracking fields.
 */
export abstract class Entity<T extends string = string> {
  constructor(
    public readonly id: T,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}

  equals(other: Entity<T>): boolean {
    if (!other) return false;
    if (this === other) return true;
    return this.id === other.id;
  }
}
