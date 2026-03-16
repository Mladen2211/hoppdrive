import { PrismaClient, ContactRequest as PrismaContactRequest } from '@prisma/client';
import {
  ContactRequest,
  Email,
  Phone,
  type IContactRequestRepository,
  type ContactRequestStatus,
} from '../../../domain';

export class PrismaContactRequestRepository implements IContactRequestRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<ContactRequest | null> {
    const row = await this.prisma.contactRequest.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findAll(options?: {
    status?: ContactRequestStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: ContactRequest[]; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;

    const where = options?.status ? { status: options.status } : {};

    const [rows, total] = await Promise.all([
      this.prisma.contactRequest.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactRequest.count({ where }),
    ]);

    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async save(request: ContactRequest): Promise<ContactRequest> {
    const row = await this.prisma.contactRequest.create({
      data: {
        id: request.id,
        fullName: request.fullName,
        email: request.email.value,
        phone: request.phone.value,
        vehicleOfInterest: request.vehicleOfInterest,
        desiredStartDate: request.desiredStartDate,
        desiredEndDate: request.desiredEndDate,
        message: request.message,
        privacyConsent: request.privacyConsent,
        marketingConsent: request.marketingConsent,
        status: request.status,
      },
    });
    return this.toDomain(row);
  }

  async update(request: ContactRequest): Promise<ContactRequest> {
    const row = await this.prisma.contactRequest.update({
      where: { id: request.id },
      data: { status: request.status },
    });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    // Hard delete for FADP compliance – no soft-delete
    await this.prisma.contactRequest.delete({ where: { id } });
  }

  async deleteOlderThan(months: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const result = await this.prisma.contactRequest.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        status: { notIn: ['converted'] },
      },
    });
    return result.count;
  }

  async count(status?: ContactRequestStatus): Promise<number> {
    return this.prisma.contactRequest.count({
      where: status ? { status } : undefined,
    });
  }

  private toDomain(row: PrismaContactRequest): ContactRequest {
    return ContactRequest.create({
      id: row.id,
      fullName: row.fullName,
      email: Email.create(row.email),
      phone: Phone.create(row.phone),
      vehicleOfInterest: row.vehicleOfInterest,
      desiredStartDate: row.desiredStartDate,
      desiredEndDate: row.desiredEndDate,
      message: row.message,
      privacyConsent: row.privacyConsent,
      marketingConsent: row.marketingConsent,
      status: row.status as ContactRequestStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
