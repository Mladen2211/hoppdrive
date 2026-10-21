/**
 * PDF helpers for the vehicle inspection reports and the contract draft: the API routes are authenticated, so
 * the PDF is fetched as a blob (Bearer header) and shown through an object URL.
 */
import { triggerBlobDownload } from '@/lib/download';

/**
 * Opens the PDF in a new tab. The tab is opened synchronously (inside the click) so popup blockers allow it and
 * is pointed at the blob afterwards; if the browser still blocks it, the PDF is downloaded instead.
 */
export async function openPdfInTab(load: () => Promise<Blob>, filename: string): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const blob = new Blob([await load()], { type: 'application/pdf' });
    if (tab && !tab.closed) {
      const url = URL.createObjectURL(blob);
      tab.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } else {
      triggerBlobDownload(blob, filename);
    }
  } catch (err) {
    tab?.close();
    throw err;
  }
}
