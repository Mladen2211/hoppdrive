/**
 * Application-layer interface for email services.
 * Implemented by BrevoEmailService in infrastructure — swapping to a future
 * in-house mail service means writing one new class against this interface
 * and changing the single construction site in container.ts.
 */
export interface IEmailService {
  sendContactConfirmation(to: string, customerName: string): Promise<void>;
  sendAdminNotification(contactRequestId: string, customerName: string, message: string): Promise<void>;
  sendContractEmail(options: {
    to: string;
    customerName: string;
    bookingId: string;
    pdfBytes: Uint8Array;
  }): Promise<void>;
  sendBookingConfirmation(options: {
    to: string;
    customerName: string;
    vehicleName: string;
    startDate: Date;
    endDate: Date;
    totalPrice: number;
    currency: string;
  }): Promise<void>;
  sendInvoiceEmail(options: {
    to: string;
    customerName: string;
    invoiceNumber: string;
    pdfBytes: Uint8Array;
  }): Promise<void>;
  sendDeclineEmail(options: {
    to: string;
    customerName: string;
    reason?: string;
  }): Promise<void>;
  sendPromotionalEmail(options: {
    to: string;
    customerName: string;
    subject: string;
    htmlContent: string;
  }): Promise<void>;
}
