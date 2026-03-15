import { Entity } from './Entity';
import { Email } from '../value-objects/Email';
import { Phone } from '../value-objects/Phone';

export type ContactRequestStatus =
  | 'pending'
  | 'reviewed'
  | 'responded'
  | 'converted'
  | 'archived';

export interface ContactRequestProps {
  id: string;
  fullName: string;
  email: Email;
  phone: Phone;
  vehicleOfInterest: string | null;
  message: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
  status: ContactRequestStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ContactRequest extends Entity {
  public fullName: string;
  public email: Email;
  public phone: Phone;
  public vehicleOfInterest: string | null;
  public message: string;
  public readonly privacyConsent: boolean;
  public readonly marketingConsent: boolean;
  public status: ContactRequestStatus;

  private constructor(props: ContactRequestProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this.fullName = props.fullName;
    this.email = props.email;
    this.phone = props.phone;
    this.vehicleOfInterest = props.vehicleOfInterest;
    this.message = props.message;
    this.privacyConsent = props.privacyConsent;
    this.marketingConsent = props.marketingConsent;
    this.status = props.status;
  }

  static create(props: ContactRequestProps): ContactRequest {
    if (!props.fullName || props.fullName.trim().length === 0) {
      throw new Error('Full name is required');
    }
    if (!props.privacyConsent) {
      throw new Error('Privacy consent is required to submit a contact request');
    }
    if (!props.message || props.message.trim().length === 0) {
      throw new Error('Message is required');
    }
    return new ContactRequest(props);
  }

  markReviewed(): void {
    this.status = 'reviewed';
    this.updatedAt = new Date();
  }

  markResponded(): void {
    this.status = 'responded';
    this.updatedAt = new Date();
  }

  markConverted(): void {
    this.status = 'converted';
    this.updatedAt = new Date();
  }

  archive(): void {
    this.status = 'archived';
    this.updatedAt = new Date();
  }

  /**
   * Checks if this request is older than the given number of months.
   * Used for FADP-compliant automated data cleanup.
   */
  isOlderThan(months: number): boolean {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return this.createdAt < cutoff;
  }
}
