import { v4 as uuid } from 'uuid';
import {
  ContactRequest,
  Email,
  Phone,
  type IContactRequestRepository,
  type ContactRequestStatus,
} from '../../../domain';
import type { IEmailService } from '../../interfaces/IEmailService';

interface CreateContactRequestInput {
  fullName: string;
  email: string;
  phone: string;
  vehicleOfInterest?: string;
  message: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
}

export class CreateContactRequestUseCase {
  constructor(
    private contactRepo: IContactRequestRepository,
    private emailService: IEmailService,
  ) {}

  async execute(input: CreateContactRequestInput): Promise<ContactRequest> {
    const contactRequest = ContactRequest.create({
      id: uuid(),
      fullName: input.fullName,
      email: Email.create(input.email),
      phone: Phone.create(input.phone),
      vehicleOfInterest: input.vehicleOfInterest ?? null,
      message: input.message,
      privacyConsent: input.privacyConsent,
      marketingConsent: input.marketingConsent,
      status: 'pending',
    });

    const saved = await this.contactRepo.save(contactRequest);

    // Send confirmation to user and notification to admin (fire-and-forget)
    try {
      await Promise.all([
        this.emailService.sendContactConfirmation(input.email, input.fullName),
        this.emailService.sendAdminNotification(saved.id, input.fullName, input.message),
      ]);
    } catch (error) {
      // Log but don't fail the request if email fails
      console.error('Failed to send email notifications:', error);
    }

    return saved;
  }
}
