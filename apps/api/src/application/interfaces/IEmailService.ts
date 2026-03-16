/**
 * Application-layer interface for email services.
 * Implemented by BrevoEmailService in infrastructure.
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
}
