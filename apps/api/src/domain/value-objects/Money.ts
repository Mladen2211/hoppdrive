/**
 * Money Value Object – immutable, ensures amount >= 0.
 */
export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: string = 'CHF',
  ) {}

  static create(amount: number, currency: string = 'CHF'): Money {
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    return new Money(Math.round(amount * 100) / 100, currency.toUpperCase());
  }

  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return Money.create(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    return Money.create(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return Money.create(this.amount * factor, this.currency);
  }

  applyDiscount(percent: number): Money {
    if (percent < 0 || percent > 100) {
      throw new Error('Discount percent must be 0-100');
    }
    return Money.create(this.amount * (1 - percent / 100), this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toString(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }

  private ensureSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot operate on different currencies: ${this.currency} vs ${other.currency}`);
    }
  }
}
