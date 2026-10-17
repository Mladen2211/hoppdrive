import {
  type IContactRequestRepository,
  type ContactRequestStatus,
} from '../../../domain';

interface UpdateContactStatusInput {
  id: string;
  status: ContactRequestStatus;
}

export class UpdateContactStatusUseCase {
  constructor(private contactRepo: IContactRequestRepository) {}

  async execute(input: UpdateContactStatusInput): Promise<void> {
    const request = await this.contactRepo.findById(input.id);
    if (!request) {
      throw new Error(`Contact request ${input.id} not found`);
    }

    switch (input.status) {
      case 'reviewed':
        request.markReviewed();
        break;
      case 'responded':
        request.markResponded();
        break;
      case 'converted':
        request.markConverted();
        break;
      case 'denied':
        request.deny();
        break;
      case 'archived':
        request.archive();
        break;
      default:
        throw new Error(`Invalid status transition: ${input.status}`);
    }

    await this.contactRepo.update(request);
  }
}
