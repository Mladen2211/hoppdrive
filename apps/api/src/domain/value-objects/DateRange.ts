/**
 * DateRange Value Object – ensures start < end, calculates days.
 */
export class DateRange {
  private constructor(
    public readonly startDate: Date,
    public readonly endDate: Date,
  ) {}

  static create(startDate: Date, endDate: Date): DateRange {
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }
    return new DateRange(startDate, endDate);
  }

  get totalDays(): number {
    const diff = this.endDate.getTime() - this.startDate.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  overlaps(other: DateRange): boolean {
    return this.startDate < other.endDate && other.startDate < this.endDate;
  }

  contains(date: Date): boolean {
    return date >= this.startDate && date <= this.endDate;
  }

  toString(): string {
    return `${this.startDate.toISOString().split('T')[0]} — ${this.endDate.toISOString().split('T')[0]}`;
  }
}
