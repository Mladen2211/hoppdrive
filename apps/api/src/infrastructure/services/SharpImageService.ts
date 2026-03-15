import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import type { IImageService } from '../../application/interfaces/IImageService';

export class SharpImageService implements IImageService {
  constructor(private uploadDir: string) {}

  async processAndSave(
    buffer: Buffer,
    originalFilename: string,
  ): Promise<{ url: string; width: number; height: number }> {
    const ext = 'webp';
    const filename = `${uuid()}.${ext}`;
    const outputPath = path.join(this.uploadDir, filename);

    // Ensure upload directory exists
    await fs.mkdir(this.uploadDir, { recursive: true });

    // Process: resize to max 1920px wide, convert to WebP for storage efficiency
    const result = await sharp(buffer)
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outputPath);

    return {
      url: `/uploads/${filename}`,
      width: result.width,
      height: result.height,
    };
  }

  async delete(url: string): Promise<void> {
    const filename = path.basename(url);
    const filePath = path.join(this.uploadDir, filename);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may not exist, that's okay
    }
  }
}
