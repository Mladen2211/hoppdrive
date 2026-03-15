import type { IContactRequestRepository } from '../../../domain';

/**
 * FADP Compliance: Delete unconverted contact requests older than N months.
 * Designed to be run as a scheduled cron job.
 */
export class CleanupOldRequestsUseCase {
  constructor(private contactRepo: IContactRequestRepository) {}

  async execute(retentionMonths: number = 12): Promise<number> {
    const deletedCount = await this.contactRepo.deleteOlderThan(retentionMonths);
    console.log(
      `[FADP Cleanup] Deleted ${deletedCount} contact requests older than ${retentionMonths} months`,
    );
    return deletedCount;
  }
}
