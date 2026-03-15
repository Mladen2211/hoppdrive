/**
 * Application-layer interface for image processing.
 * Implemented by SharpImageService in infrastructure.
 */
export interface IImageService {
  processAndSave(
    buffer: Buffer,
    filename: string,
  ): Promise<{ url: string; width: number; height: number }>;
  delete(url: string): Promise<void>;
}
