import path from 'path';
import fs from 'fs/promises';
import type { PrismaClient } from '@prisma/client';
import { PrivateStorageService } from './PrivateStorageService';

const CONTRACT_KEY_RE = /^contracts\/[A-Za-z0-9-]+\.pdf$/;

/**
 * Persists signed rental contracts as immutable files in the PRIVATE storage (never served by
 * express.static): contracts contain personal data and a signature and must stay behind an
 * authenticated route.
 *
 * Booking.contractPdfPath holds the storage key ("contracts/<bookingId>.pdf"). Older rows hold the
 * absolute path of the file below UPLOAD_DIR/contracts; migrateLegacyFiles() moves those at startup,
 * and read() still understands them until then.
 */
export class ContractStorageService {
  constructor(
    private storage: PrivateStorageService,
    /** UPLOAD_DIR (the public directory the legacy files were written to). */
    private legacyUploadDir: string,
  ) {}

  /** Stores the contract and returns its storage key (to be saved in Booking.contractPdfPath). */
  async save(bookingId: string, pdfBytes: Uint8Array): Promise<string> {
    return this.storage.save(PrivateStorageService.keys.contract(bookingId), pdfBytes);
  }

  /** Reads a contract by storage key (or a legacy file path). Rejects when the file is missing. */
  async read(keyOrPath: string): Promise<Buffer> {
    if (CONTRACT_KEY_RE.test(keyOrPath)) return this.storage.read(keyOrPath);
    // Legacy absolute / relative path written by older versions.
    return fs.readFile(keyOrPath);
  }

  /**
   * Startup migration: moves UPLOAD_DIR/contracts/*.pdf into the private storage and rewrites
   * Booking.contractPdfPath. Safe to run on every start (does nothing when the directory is empty).
   */
  async migrateLegacyFiles(prisma: PrismaClient): Promise<{ moved: number; updated: number; skipped: number }> {
    const dir = path.resolve(this.legacyUploadDir, 'contracts');
    let names: string[];
    try {
      names = (await fs.readdir(dir)).filter((n) => n.toLowerCase().endsWith('.pdf'));
    } catch {
      return { moved: 0, updated: 0, skipped: 0 };
    }

    let moved = 0;
    let updated = 0;
    let skipped = 0;
    for (const name of names) {
      const bookingId = name.slice(0, -4);
      const key = `contracts/${name}`;
      if (!CONTRACT_KEY_RE.test(key)) {
        skipped++;
        continue;
      }
      try {
        if (await this.storage.exists(key)) {
          // A private copy already exists (newer write): never overwrite it, never leave the public copy.
          await fs.unlink(path.join(dir, name));
        } else {
          await this.storage.importFile(path.join(dir, name), key);
          moved++;
        }
        const result = await prisma.booking.updateMany({
          where: { id: bookingId, NOT: { contractPdfPath: key } },
          data: { contractPdfPath: key },
        });
        updated += result.count;
      } catch (err) {
        skipped++;
        console.error(`[Storage] Could not move legacy contract ${name}:`, err);
      }
    }
    return { moved, updated, skipped };
  }
}
