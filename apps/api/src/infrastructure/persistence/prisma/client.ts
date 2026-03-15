import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let instance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!instance) {
    instance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return instance;
}

export { prisma };
export default prisma;
