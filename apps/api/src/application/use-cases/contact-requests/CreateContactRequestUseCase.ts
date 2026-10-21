import { v4 as uuid } from 'uuid';
import {
  ContactRequest,
  Email,
  Phone,
  type IContactRequestRepository,
  type ContactRequestStatus,
} from '../../../domain';
import type { IEmailService } from '../../interfaces/IEmailService';
import type { ISettingsReader } from '../../interfaces/ISettingsReader';
import type { IMarketingConsent } from '../../interfaces/IMarketingConsent';

interface CreateContactRequestInput {
  fullName: string;
  email: string;
  phone: string;
  vehicleOfInterest?: string;
  message: string;
  desiredStartDate?: string;
  desiredEndDate?: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
  locale?: string;
  /** Code from the form; stored uppercase and applied when the inquiry is approved. */
  discountCode?: string;
}

export class CreateContactRequestUseCase {
  constructor(
    private contactRepo: IContactRequestRepository,
    private emailService: IEmailService,
    private settingsReader?: ISettingsReader,
    private marketing?: IMarketingConsent,
  ) {}

  async execute(input: CreateContactRequestInput): Promise<ContactRequest> {
    const contactRequest = ContactRequest.create({
      id: uuid(),
      fullName: input.fullName,
      email: Email.create(input.email),
      phone: Phone.create(input.phone),
      vehicleOfInterest: input.vehicleOfInterest ?? null,
      desiredStartDate: input.desiredStartDate ? new Date(input.desiredStartDate) : null,
      desiredEndDate: input.desiredEndDate ? new Date(input.desiredEndDate) : null,
      message: input.message,
      privacyConsent: input.privacyConsent,
      marketingConsent: input.marketingConsent,
      discountCode: input.discountCode?.trim().toUpperCase() || null,
      locale: input.locale ?? null,
      status: 'pending',
    });

    const saved = await this.contactRepo.save(contactRequest);

    // An explicit opt-in makes the address eligible for campaigns (and clears an earlier unsubscribe).
    if (input.marketingConsent && this.marketing) {
      try {
        await this.marketing.recordOptIn(input.email, 'contact_form');
      } catch (error) {
        console.error('Failed to record marketing consent:', error);
      }
    }

    // Send confirmation to user and notification to admin (fire-and-forget).
    // The admin mail honours Settings → notifications.emailOnInquiry and company.inquiryEmail.
    try {
      const notify = (await this.settingsReader?.getInquiryNotificationSettings()) ?? {
        enabled: true,
        recipient: undefined,
      };
      await Promise.all([
        this.emailService.sendContactConfirmation(input.email, input.fullName, {
          vehicleOfInterest: input.vehicleOfInterest,
          desiredStart: saved.desiredStartDate,
          desiredEnd: saved.desiredEndDate,
        }),
        notify.enabled
          ? this.emailService.sendAdminNotification(saved.id, input.fullName, input.message, notify.recipient)
          : Promise.resolve(),
      ]);
    } catch (error) {
      // Log but don't fail the request if email fails
      console.error('Failed to send email notifications:', error);
    }

    return saved;
  }
}
