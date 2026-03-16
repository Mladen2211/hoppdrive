import { PrismaClient, Admin as PrismaAdmin } from '@prisma/client';
import { Admin, Email, type IAdminRepository } from '../../../domain';

export class PrismaAdminRepository implements IAdminRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Admin | null> {
    const row = await this.prisma.admin.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<Admin | null> {
    const row = await this.prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(admin: Admin): Promise<Admin> {
    const row = await this.prisma.admin.create({
      data: {
        id: admin.id,
        email: admin.email.value,
        name: admin.name,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone,
        passwordHash: admin.passwordHash,
        mustResetPassword: admin.mustResetPassword,
      },
    });
    return this.toDomain(row);
  }

  async update(admin: Admin): Promise<Admin> {
    const row = await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        email: admin.email.value,
        name: admin.name,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone,
        passwordHash: admin.passwordHash,
        mustResetPassword: admin.mustResetPassword,
      },
    });
    return this.toDomain(row);
  }

  private toDomain(row: PrismaAdmin): Admin {
    return Admin.create({
      id: row.id,
      email: Email.create(row.email),
      name: row.name,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      passwordHash: row.passwordHash,
      mustResetPassword: row.mustResetPassword,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
