import cron from 'node-cron';
import { createApp } from './presentation/app';
import { createContainer } from './infrastructure/config/container';
import { getPrismaClient } from './infrastructure/persistence/prisma/client';
import { ensureDefaultFees } from './presentation/routes/feeRoutes';

async function bootstrap() {
  const container = createContainer();
  const app = createApp(container);
  const port = process.env.API_PORT || process.env.PORT || 97;

  // ─── FADP/GDPR Compliance: Auto-delete old contact requests ───
  // Runs every day at 03:00 AM — deletes unconverted requests older than 12 months
  cron.schedule('0 3 * * *', async () => {
    try {
      const deleted = await container.cleanupOldRequests.execute(12);
      console.log(`[Cron] Cleaned up ${deleted} old contact requests`);
    } catch (err) {
      console.error('[Cron] Cleanup failed:', err);
    }
  });

  // ─── Housekeeping: expired / used password-reset tokens ───────
  // Runs every day at 03:15 AM — removes tokens that expired or were used over a week ago
  cron.schedule('15 3 * * *', async () => {
    try {
      const removed = await container.resetTokenRepo.deleteOlderThan(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      );
      if (removed > 0) console.log(`[Cron] Removed ${removed} old password-reset tokens`);
    } catch (err) {
      console.error('[Cron] Reset-token cleanup failed:', err);
    }
  });

  // ─── Housekeeping: e-mail log ─────────────────────────────────
  // Runs every day at 03:30 AM — removes sent / failed log rows (and their attachments) older than 180 days
  cron.schedule('30 3 * * *', async () => {
    try {
      const removed = await container.emailService.purgeOld(180);
      if (removed > 0) console.log(`[Cron] Removed ${removed} old e-mail log entries`);
    } catch (err) {
      console.error('[Cron] E-mail log cleanup failed:', err);
    }
  });

  // ─── Private storage: move signed contracts out of the public uploads folder ───
  // Older versions saved contracts below UPLOAD_DIR/contracts (served by /uploads). They are moved into the
  // private storage once and Booking.contractPdfPath is rewritten. Safe to run on every start.
  try {
    const moved = await container.contractStorage.migrateLegacyFiles(container.prisma);
    if (moved.moved > 0 || moved.updated > 0 || moved.skipped > 0) {
      console.log(`[startup] Contracts moved to private storage: ${moved.moved} files, ${moved.updated} bookings updated, ${moved.skipped} skipped`);
    }
  } catch (err) {
    console.error('[startup] Contract migration failed (downloads fall back to the old location):', err);
  }

  // ─── Fee catalog: seed the defaults once (only while the catalog is empty) ───
  try {
    const created = await ensureDefaultFees(container.prisma);
    if (created > 0) console.log(`[startup] Default fees created: ${created}`);
  } catch (err) {
    console.error('[startup] Default fees could not be created:', err);
  }

  // ─── E-mail outbox worker (retries with backoff, bulk campaigns) ───
  container.emailWorker.start();

  const server = app.listen(port, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║  HoppDrive API                              ║
║  Running on http://localhost:${port}            ║
║  Environment: ${process.env.NODE_ENV || 'development'}              ║
╚══════════════════════════════════════════════╝
    `);
  });

  // ─── Graceful Shutdown ─────────────────────────────────────
  const shutdown = async (signal: string) => {
    container.emailWorker.stop();
    console.log(`\n[shutdown] Received ${signal}. Closing server...`);
    server.close(async () => {
      try {
        await getPrismaClient().$disconnect();
        console.log('[shutdown] Database disconnected. Exiting.');
      } catch (err) {
        console.error('[shutdown] Error disconnecting:', err);
      }
      process.exit(0);
    });

    // Force exit if server doesn't close within 10 seconds
    setTimeout(() => {
      console.error('[shutdown] Forced exit after timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
