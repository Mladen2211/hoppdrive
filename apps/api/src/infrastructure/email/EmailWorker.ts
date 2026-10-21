import type { EmailService } from './EmailService';

/**
 * In-process worker for the e-mail outbox. Every few seconds it takes the due QUEUED messages
 * (new bulk mails and retries whose backoff has elapsed) and delivers them one by one.
 *
 * Safe on restart and with several API instances: messages are claimed with an atomic UPDATE and leased,
 * so nothing is sent twice at once, and a crash leaves the message QUEUED so it is picked up again.
 */
export class EmailWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private emailService: EmailService,
    private options: { intervalMs?: number; batchSize?: number } = {},
  ) {}

  start(): void {
    if (this.timer) return;
    const interval = this.options.intervalMs ?? 10_000;
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref?.();
    // Pick up whatever was left over from before the restart.
    setTimeout(() => void this.tick(), 2_000).unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  /** One pass; exported for tests and for a manual "process now". Returns the number of messages handled. */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let handled = 0;
    try {
      const ids = await this.emailService.findDueIds(this.options.batchSize ?? 25);
      for (const id of ids) {
        const msg = await this.emailService.claim(id);
        if (!msg) continue;
        await this.emailService.deliver(msg);
        handled++;
      }
    } catch (err) {
      console.error('[EmailWorker] Pass failed:', err);
    } finally {
      this.running = false;
    }
    return handled;
  }
}
