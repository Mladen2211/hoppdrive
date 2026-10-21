import type { AdminRole } from '@hoppdrive/shared';

/** Result of handing a mail to the outbox. */
export interface EmailSendResult {
  /** EmailMessage id (outbox / log row). */
  id: string;
  /**
   * SENT   = the first delivery attempt succeeded.
   * QUEUED = not delivered yet (the worker retries with backoff, or the mail waits for the worker).
   * FAILED = permanently failed (all attempts used up, or blocked).
   */
  status: 'SENT' | 'QUEUED' | 'FAILED';
  error?: string;
}

/** A file attached to a mail: either raw bytes (stored by the outbox) or an existing private-storage key. */
export interface EmailAttachmentInput {
  filename: string;
  contentType?: string;
  bytes?: Uint8Array;
  /** Key in the PrivateStorageService of a file that already exists (e.g. the signed contract). */
  storageKey?: string;
}

/** Links the log row to a domain object (shown in the admin e-mail log). */
export interface EmailRelated {
  type: string;
  id: string;
}

/**
 * Application-layer interface for email.
 *
 * Every method builds a branded German message from a template, writes it to the outbox
 * (EmailMessage) and tries to deliver it right away. Failed deliveries are retried by the
 * outbox worker (3 retries, exponential backoff), so a method never throws because the mail
 * provider is down: check `status` of the result if you need to tell the user ("emailSent").
 * The transport (Brevo / SMTP / Listmonk / log) is chosen with EMAIL_PROVIDER.
 */
export interface IEmailService {
  sendContactConfirmation(
    to: string,
    customerName: string,
    details?: { vehicleOfInterest?: string | null; desiredStart?: Date | null; desiredEnd?: Date | null },
  ): Promise<EmailSendResult>;
  /**
   * @param toOverride Recipient for this notification (Settings → company.inquiryEmail).
   *                   When omitted ADMIN_NOTIFICATION_EMAIL is used.
   */
  sendAdminNotification(
    contactRequestId: string,
    customerName: string,
    message: string,
    toOverride?: string,
  ): Promise<EmailSendResult>;
  /** Signed contract incl. AGB (single PDF). */
  sendContractEmail(options: {
    to: string;
    customerName: string;
    bookingId: string;
    pdfBytes: Uint8Array;
  }): Promise<EmailSendResult>;
  sendBookingConfirmation(options: {
    to: string;
    customerName: string;
    vehicleName: string;
    startDate: Date;
    endDate: Date;
    totalPrice: number;
    currency: string;
    discountAmount?: number;
    bookingRef?: string;
    related?: EmailRelated;
  }): Promise<EmailSendResult>;
  /** Invoice mail; with `reminder` it is the payment reminder (Mahnung) for a reissued invoice. */
  sendInvoiceEmail(options: {
    to: string;
    customerName: string;
    invoiceNumber: string;
    pdfBytes: Uint8Array;
    total: number;
    currency: string;
    dueDate: Date;
    withQrBill?: boolean;
    related?: EmailRelated;
    reminder?: {
      originalInvoiceNumber: string;
      dueDate: Date;
      /** Free text from the admin; shown below the standard reminder text. */
      note?: string;
    };
  }): Promise<EmailSendResult>;
  sendDeclineEmail(options: {
    to: string;
    customerName: string;
    reason?: string;
  }): Promise<EmailSendResult>;
  /** Invitation to join the admin area (link to `${ADMIN_URL}/accept-invite?token=...`). */
  sendAdminInvite(options: {
    to: string;
    inviteUrl: string;
    /** Display name of the admin who sent the invite. */
    invitedBy: string;
    role: AdminRole;
  }): Promise<EmailSendResult>;
  /** Confirmation to the new user after accepting the invite. */
  sendAdminInviteAccepted(options: {
    to: string;
    name: string;
    role: AdminRole;
  }): Promise<EmailSendResult>;
  /** Password reset link (to `${ADMIN_URL}/reset-password?token=...`). */
  sendPasswordReset(options: {
    to: string;
    resetUrl: string;
    expiresInMinutes: number;
  }): Promise<EmailSendResult>;

  /** Contract package: signed contract + damage report (+ photos) + invoice, whatever exists. */
  sendContractPackage(options: {
    to: string;
    customerName: string;
    bookingRef: string;
    vehicleName: string;
    startDate: Date;
    endDate: Date;
    attachments: EmailAttachmentInput[];
    includes: { contract: boolean; damageReport: boolean; invoice: boolean };
    related?: EmailRelated;
  }): Promise<EmailSendResult>;
  /** Invoice for damages found at the return. */
  sendDamageInvoice(options: {
    to: string;
    customerName: string;
    invoiceNumber: string;
    total: number;
    currency: string;
    dueDate: Date;
    vehicleName?: string | null;
    bookingRef?: string | null;
    damageLines?: string[];
    withQrBill?: boolean;
    attachments: EmailAttachmentInput[];
    related?: EmailRelated;
  }): Promise<EmailSendResult>;
  /** Notice to the renter that a fine arrived for their rental period. */
  sendFineNotice(options: {
    to: string;
    customerName: string;
    licensePlate: string;
    occurredAt: Date;
    place?: string | null;
    authority?: string | null;
    reference?: string | null;
    amount: number;
    currency: string;
    note?: string | null;
    attachments?: EmailAttachmentInput[];
    related?: EmailRelated;
  }): Promise<EmailSendResult>;
  /** Invoice for a fine (+ administrative fee). */
  sendFineInvoice(options: {
    to: string;
    customerName: string;
    invoiceNumber: string;
    total: number;
    currency: string;
    dueDate: Date;
    licensePlate: string;
    occurredAt: Date;
    place?: string | null;
    authority?: string | null;
    reference?: string | null;
    withQrBill?: boolean;
    attachments: EmailAttachmentInput[];
    related?: EmailRelated;
  }): Promise<EmailSendResult>;

  /** One discount-campaign mail. Queued for the worker (not sent inline) because campaigns are bulk. */
  sendDiscountCampaign(options: {
    to: string;
    recipientName?: string | null;
    subject: string;
    message: string;
    code?: string | null;
    discountText?: string | null;
    validUntil?: Date | null;
    unsubscribeUrl: string;
    related?: EmailRelated;
  }): Promise<EmailSendResult>;
  /** "You are unsubscribed" confirmation. */
  sendUnsubscribeConfirmation(to: string): Promise<EmailSendResult>;
  /** Test mail from the admin e-mail settings. */
  sendTest(to: string, sentBy?: string | null): Promise<EmailSendResult>;
}
