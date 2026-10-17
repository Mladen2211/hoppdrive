import path from 'path';
import fs from 'fs/promises';

/**
 * Persists signed rental contracts as immutable files, separate from the
 * public /uploads mount used for vehicle images — contracts contain personal
 * data and a signature, and must stay behind an authenticated route.
 */
export class ContractStorageService {
  constructor(private uploadDir: string) {}

  async save(bookingId: string, pdfBytes: Uint8Array): Promise<string> {
    const dir = path.join(this.uploadDir, 'contracts');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${bookingId}.pdf`);
    await fs.writeFile(filePath, pdfBytes);
    return filePath;
  }

  async read(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }
}
