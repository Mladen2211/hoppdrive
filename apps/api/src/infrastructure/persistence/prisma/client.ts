import { PrismaClient } from '@prisma/client';

let instance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!instance) {
    instance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return instance;
}

// Re-export the singleton for legacy imports
export const prisma = getPrismaClient();
export default prisma;
