import cron from 'node-cron';
import { createApp } from './presentation/app';
import { createContainer } from './infrastructure/config/container';

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

  app.listen(port, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║  HoppDrive API                              ║
║  Running on http://localhost:${port}            ║
║  Environment: ${process.env.NODE_ENV || 'development'}              ║
╚══════════════════════════════════════════════╝
    `);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
