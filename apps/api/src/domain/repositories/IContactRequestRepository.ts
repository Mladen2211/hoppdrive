import { ContactRequest, ContactRequestStatus } from '../entities/ContactRequest';

export interface IContactRequestRepository {
  findById(id: string): Promise<ContactRequest | null>;
  findAll(options?: {
    status?: ContactRequestStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: ContactRequest[]; total: number }>;
  save(request: ContactRequest): Promise<ContactRequest>;
  update(request: ContactRequest): Promise<ContactRequest>;
  delete(id: string): Promise<void>;
  deleteOlderThan(months: number): Promise<number>;
  count(status?: ContactRequestStatus): Promise<number>;
}
