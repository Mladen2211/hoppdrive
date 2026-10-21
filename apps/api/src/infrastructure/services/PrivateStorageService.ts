import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';

/**
 * File storage that is NEVER served statically (unlike UPLOAD_DIR, which express mounts at /uploads).
 *
 * Everything that contains personal data lives here: signed contracts, contract templates, damage
 * photos, inspection reports, fine documents, generated PDFs and e-mail attachments. Files are only
 * reachable through authenticated routes that call read() / createReadStream().
 *
 * A file is addressed by a relative, forward-slash "storage key" (for example
 * "contracts/<bookingId>.pdf"). Keys are what the database stores. Keys are validated so they can
 * never escape the root directory.
 *
 * Directory: PRIVATE_UPLOAD_DIR (default ./private). In Docker it is the `private` volume.
 */
export class PrivateStorageService {
  readonly rootDir: string;

  constructor(rootDir: string = process.env.PRIVATE_UPLOAD_DIR || './private') {
    this.rootDir = path.resolve(rootDir);
  }

  /** Storage key helpers, so that every module builds the same names. */
  static keys = {
    contract: (bookingId: string) => `contracts/${bookingId}.pdf`,
    contractTemplate: (templateId: string) => `contract-templates/${templateId}.pdf`,
    agb: () => 'legal/agb.pdf',
    damagePhoto: (damageId: string) => `damages/${damageId}/${randomUUID()}.jpg`,
    inspectionReport: (bookingId: string, inspectionId: string) => `inspections/${bookingId}/${inspectionId}.pdf`,
    fineDocument: (fineId: string, fileName: string) => `fines/${fineId}/${PrivateStorageService.safeName(fileName)}`,
    emailAttachment: (messageId: string, fileName: string) => `email/${messageId}/${PrivateStorageService.safeName(fileName)}`,
    invoicePdf: (invoiceId: string) => `invoices/${invoiceId}.pdf`,
  };

  /** File names reduced to a safe subset (no path separators, no leading dots). */
  static safeName(fileName: string): string {
    const base = path.basename(fileName.replace(/\\/g, '/'));
    const cleaned = base.replace(/[^\p{L}\p{N}._ -]+/gu, '_').replace(/^\.+/, '').trim();
    return (cleaned || 'file').slice(0, 120);
  }

  /** Absolute path of a key. Throws for keys that would leave the root directory. */
  resolve(key: string): string {
    const normalised = key.replace(/\\/g, '/');
    if (!normalised || normalised.startsWith('/') || normalised.split('/').some((p) => p === '..' || p === '')) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    const abs = path.resolve(this.rootDir, normalised);
    if (abs !== this.rootDir && !abs.startsWith(this.rootDir + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return abs;
  }

  async save(key: string, data: Uint8Array | Buffer): Promise<string> {
    const abs = this.resolve(key);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    // Write to a temp file first so a crash never leaves a half-written PDF behind.
    const tmp = `${abs}.${randomUUID()}.tmp`;
    await fsp.writeFile(tmp, data);
    await fsp.rename(tmp, abs);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return fsp.readFile(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fsp.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async size(key: string): Promise<number> {
    return (await fsp.stat(this.resolve(key))).size;
  }

  createReadStream(key: string): Readable {
    return fs.createReadStream(this.resolve(key));
  }

  /** Deletes a file; a missing file is not an error. */
  async delete(key: string): Promise<void> {
    try {
      await fsp.unlink(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  /** Deletes a whole "directory" (for example email/<messageId>). */
  async deletePrefix(prefix: string): Promise<void> {
    await fsp.rm(this.resolve(prefix), { recursive: true, force: true });
  }

  /** Moves an arbitrary file from disk into the storage (copy + delete: works across volumes). */
  async importFile(absoluteSource: string, key: string): Promise<void> {
    const abs = this.resolve(key);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.copyFile(absoluteSource, abs);
    await fsp.unlink(absoluteSource);
  }

  /**
   * Streams a stored file as a download / inline response. Sends 404 when the file is missing.
   * Content-Disposition is "attachment" unless inline is requested (images, previews).
   */
  async sendFile(
    res: import('express').Response,
    key: string,
    options: { filename: string; contentType: string; inline?: boolean },
  ): Promise<void> {
    let size: number;
    try {
      size = await this.size(key);
    } catch {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }
    res.setHeader('Content-Type', options.contentType);
    res.setHeader('Content-Length', size);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const asciiName = options.filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    res.setHeader(
      'Content-Disposition',
      `${options.inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(options.filename)}`,
    );
    await new Promise<void>((resolve) => {
      const stream = this.createReadStream(key);
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.destroy();
        resolve();
      });
      res.on('close', resolve);
      stream.pipe(res);
    });
  }
}
