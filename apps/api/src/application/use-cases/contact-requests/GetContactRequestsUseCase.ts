import {
  ContactRequest,
  type IContactRequestRepository,
  type ContactRequestStatus,
} from '../../../domain';

interface GetContactRequestsInput {
  status?: ContactRequestStatus;
  page?: number;
  pageSize?: number;
}

export class GetContactRequestsUseCase {
  constructor(private contactRepo: IContactRequestRepository) {}

  async execute(input: GetContactRequestsInput = {}): Promise<{
    items: ContactRequest[];
    total: number;
  }> {
    return this.contactRepo.findAll({
      status: input.status,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 20,
    });
  }
}
