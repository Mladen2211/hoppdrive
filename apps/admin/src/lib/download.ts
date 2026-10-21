/**
 * Browser download helpers (replace the copy-pasted createObjectURL blocks).
 *
 *   triggerBlobDownload(blob, 'vertrag-2026-0042.pdf');
 *   downloadCsv([['Fahrzeug', 'Tage', 'Preis (CHF)'], ['Škoda Superb', 14, '995.40']], 'bericht.csv');
 *
 * downloadCsv writes a UTF-8 file with BOM (so Excel shows Š, ü correctly),
 * ';' as separator (Swiss/German Excel default) and '\n' line breaks, matching
 * the existing report export. Cells are quoted only when needed; text that a
 * spreadsheet could execute as a formula (starts with = @ or a non-numeric + / -)
 * is prefixed with an apostrophe.
 */

import { fmtDate } from './format';
import { tr } from '@/i18n/active';

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type CsvCell = string | number | boolean | Date | null | undefined;

const NUMERIC_LOOKING = /^[+-]?[\d\s.,'’()+-]+$/;

function csvCell(value: CsvCell, separator: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? tr('download.ja') : tr('download.nein');
  let text = value instanceof Date ? fmtDate(value) : String(value);
  if (/^[=@\t\r]/.test(text) || (/^[+-]/.test(text) && !NUMERIC_LOOKING.test(text))) {
    text = `'${text}`;
  }
  if (text.includes('"') || text.includes(separator) || /[\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvFromRows(rows: CsvCell[][], separator = ';'): string {
  return rows.map((row) => row.map((cell) => csvCell(cell, separator)).join(separator)).join('\n');
}

export function downloadCsv(rows: CsvCell[][], filename: string, options: { separator?: string } = {}): void {
  const csv = csvFromRows(rows, options.separator ?? ';');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}
