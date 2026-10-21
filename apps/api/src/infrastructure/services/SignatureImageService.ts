import sharp from 'sharp';
import { AppError } from '../../application/errors';

/** The stored data URL (users.signature_data) must stay below this many bytes. */
export const MAX_SIGNATURE_DATA_URL_BYTES = 150_000;

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 1200;
/** Alpha above this value counts as "ink" when computing the trim box. */
const INK_ALPHA = 12;

/**
 * Turns a drawn signature (data URL) or an uploaded PNG / JPG photo into a clean signature:
 * white / light background removed (transparent PNG), cropped to the ink, at most 1200 px wide,
 * stored as a PNG data URL of at most 150 KB.
 */
export class SignatureImageService {
  /** `input` is a data URL (data:image/png;base64,...) or the raw image bytes. */
  async normalise(input: string | Buffer): Promise<string> {
    const raw = typeof input === 'string' ? this.decodeDataUrl(input) : input;
    if (raw.length > MAX_INPUT_BYTES) {
      throw new AppError('Die Bilddatei ist zu gross (maximal 8 MB).', 413, 'signature_too_large');
    }

    let decoded: { data: Buffer; info: sharp.OutputInfo };
    try {
      // rotate() honours the EXIF orientation of phone photos
      decoded = await sharp(raw, { limitInputPixels: 80_000_000 })
        .rotate()
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new AppError('Die Datei ist kein gültiges Bild (PNG oder JPG).', 422, 'signature_invalid_image');
    }

    const { width, height } = decoded.info;
    const pixels = decoded.data; // RGBA, 4 channels
    this.removeLightBackground(pixels);

    const box = this.inkBox(pixels, width, height);
    if (!box) {
      throw new AppError('Auf dem Bild wurde keine Unterschrift erkannt.', 422, 'signature_empty');
    }

    // Small margin so strokes are not clipped by the crop.
    const margin = Math.max(2, Math.round(Math.max(box.width, box.height) * 0.02));
    const left = Math.max(0, box.left - margin);
    const top = Math.max(0, box.top - margin);
    const cropW = Math.min(width - left, box.width + margin * 2);
    const cropH = Math.min(height - top, box.height + margin * 2);

    const base = sharp(pixels, { raw: { width, height, channels: 4 } }).extract({
      left,
      top,
      width: cropW,
      height: cropH,
    });

    // Shrink until the data URL fits. Palette PNGs keep transparency and are much smaller.
    for (const maxWidth of [MAX_WIDTH, 900, 700, 520, 400]) {
      const png = await base
        .clone()
        .resize({ width: maxWidth, withoutEnlargement: true })
        .png({ palette: true, quality: 85, compressionLevel: 9, effort: 8 })
        .toBuffer();
      const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
      if (Buffer.byteLength(dataUrl, 'utf8') <= MAX_SIGNATURE_DATA_URL_BYTES) return dataUrl;
    }
    throw new AppError('Die Unterschrift ist zu komplex. Bitte ein einfacheres Bild verwenden.', 413, 'signature_too_large');
  }

  private decodeDataUrl(value: string): Buffer {
    const match = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/i.exec(value.trim());
    if (!match) {
      throw new AppError('Unterschrift muss als PNG- oder JPG-Data-URL (base64) übergeben werden.', 422, 'signature_invalid_image');
    }
    return Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  }

  /**
   * Makes light pixels transparent: alpha grows with the darkness of the pixel, so a white or
   * grey paper background disappears and anti-aliased strokes stay smooth. Pixels that are already
   * transparent (drawn on a canvas) stay as they are.
   */
  private removeLightBackground(rgba: Buffer): void {
    for (let i = 0; i < rgba.length; i += 4) {
      const existingAlpha = rgba[i + 3];
      if (existingAlpha === 0) continue;
      const darkness = 255 - Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
      // ~7 % dark and below = paper; fully ink at ~60 % darkness
      const lifted = Math.max(0, Math.min(255, Math.round((darkness - 18) * 1.7)));
      rgba[i + 3] = Math.min(existingAlpha, lifted);
    }
  }

  private inkBox(
    rgba: Buffer,
    width: number,
    height: number,
  ): { left: number; top: number; width: number; height: number } | null {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      const row = y * width * 4;
      for (let x = 0; x < width; x++) {
        if (rgba[row + x * 4 + 3] > INK_ALPHA) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }
}
