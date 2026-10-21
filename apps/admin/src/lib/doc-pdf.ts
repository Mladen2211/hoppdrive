/**
 * Opening and sizing of documents (PDFs from the API, uploads).
 *
 *   void openPdfInTab(() => api.previewContractTemplate(id, bookingId), 'vorschau.pdf');
 *
 * `openPdfInTab` / `openBlobInTab` must be called straight from a click handler: it opens the tab synchronously (so the
 * pop-up blocker allows it), shows a short "loading" note and navigates the tab to the PDF once the
 * request has finished. If the browser blocked the tab the file is downloaded instead.
 */
import { triggerBlobDownload } from '@/lib/download';
import { tr } from '@/i18n/active';

export async function openBlobInTab(load: () => Promise<Blob>, filename: string, type = 'application/pdf'): Promise<void> {
  const tab = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  if (tab) {
    try {
      tab.opener = null;
      tab.document.title = filename;
      tab.document.body.style.cssText = 'font:16px system-ui,sans-serif;padding:24px;color:#444';
      tab.document.body.textContent = tr('documents.pdfLoading');
    } catch {
      /* the tab is not scriptable (extension, strict browser): navigate it anyway below */
    }
  }
  try {
    const blob = await load();
    const typed = blob.type === type ? blob : new Blob([blob], { type });
    if (tab && !tab.closed) {
      const url = URL.createObjectURL(typed);
      tab.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);
    } else {
      triggerBlobDownload(typed, filename);
    }
  } catch (err) {
    if (tab && !tab.closed) tab.close();
    throw err;
  }
}

export const openPdfInTab = (load: () => Promise<Blob>, filename: string): Promise<void> => openBlobInTab(load, filename, 'application/pdf');

/** Public URL of the current AGB (bundled or uploaded); needs no login. */
export function agbUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';
  return `${base.replace(/\/+$/, '')}/legal/agb`;
}

/** 1.4 MB, 820 KB, 12 B: file sizes for the UI. */
export function fmtFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
