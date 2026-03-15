/**
 * Phone Value Object – validates Swiss / international phone format.
 */
export class Phone {
  private static readonly PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;

  private constructor(public readonly value: string) {}

  static create(phone: string): Phone {
    const trimmed = phone.trim();
    if (!Phone.PHONE_REGEX.test(trimmed)) {
      throw new Error(`Invalid phone number: ${phone}`);
    }
    return new Phone(trimmed);
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
