/**
 * Licence plates (Kontrollschild). The API stores them normalised: upper case, no spaces, dots or dashes
 * ('ZH 123 456' -> 'ZH123456'). The UI shows Swiss plates grouped for reading ('ZH 123 456').
 */

/** Same normalisation as the API (uppercase, only letters and digits). */
export function normalizePlate(input: string | null | undefined): string {
  return (input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** 'ZH123456' -> 'ZH 123 456', 'GE12345' -> 'GE 12 345'. Other formats are returned normalised. */
export function formatPlate(input: string | null | undefined): string {
  const plate = normalizePlate(input);
  const match = /^([A-Z]{2})(\d{1,6})$/.exec(plate);
  if (!match) return plate;
  const digits = match[2];
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end));
  return `${match[1]} ${groups.join(' ')}`;
}
