/** Removes spaces and upper-cases: "ch93 0076 2011 6238 5295 7" -> "CH9300762011623852957". */
export function normalizeIban(input: string | null | undefined): string {
  return (input ?? '').replace(/\s+/g, '').toUpperCase();
}

/** Formats in groups of four for display: CH93 0076 2011 6238 5295 7 */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, '$1 ').trim();
}

/** ISO 13616 check: structure + mod 97. */
export function isValidIban(input: string | null | undefined): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** QR-IBAN: a Swiss / Liechtenstein IBAN whose institution ID (positions 5-9) is 30000-31999. */
export function isQrIban(input: string | null | undefined): boolean {
  const iban = normalizeIban(input);
  if (!isValidIban(iban) || !/^(CH|LI)/.test(iban)) return false;
  const iid = Number(iban.slice(4, 9));
  return iid >= 30000 && iid <= 31999;
}
