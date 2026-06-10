import cron from 'node-cron';
import { createApp } from './presentation/app';
import { createContainer } from './infrastructure/config/container';
import { getPrismaClient } from './infrastructure/persistence/prisma/client';

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
