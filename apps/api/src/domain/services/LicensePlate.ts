/**
 * Licence plates are stored and compared in a normalised form: upper case, without spaces, dots,
 * dashes or other separators ("ZH 123 456", "zh-123.456" and "ZH123456" are the same plate).
 */
export function normalizeLicensePlate(input: string | null | undefined): string {
  return (input ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\s.\-_·'’/\\]+/g, '');
}

/** 2-12 letters / digits after normalisation (foreign plates included). */
export function isValidLicensePlate(normalised: string): boolean {
  return /^[\p{L}\p{N}]{2,12}$/u.test(normalised);
}

/** Human-friendly display, e.g. ZH123456 -> "ZH 123456". Falls back to the stored value. */
export function formatLicensePlate(normalised: string | null | undefined): string {
  if (!normalised) return '';
  const m = /^([A-Z]{2})(\d{1,6})$/.exec(normalised);
  return m ? `${m[1]} ${m[2]}` : normalised;
}
