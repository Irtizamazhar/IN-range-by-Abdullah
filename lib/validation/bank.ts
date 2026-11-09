/*
 * Bank details. Pakistani banks use different account-number lengths, so no single bank format is
 * assumed: an account number is digits only (6–24 after removing spaces/dashes). A Pakistani IBAN
 * (PK + 2 check digits + 4-letter bank code + 16 characters = 24) is checked with the ISO 13616
 * mod-97 checksum. Pure functions: safe for browser bundles.
 */
export const ACCOUNT_NUMBER_ERROR = "Account number must be 6–24 digits (spaces and dashes are ignored), or a valid PK IBAN.";
export const IBAN_ERROR = "Enter a valid Pakistani IBAN: PK, 2 check digits, 4-letter bank code and 16 digits (24 characters).";

export function compactBankValue(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidPakistanIban(value: string): boolean {
  const iban = compactBankValue(value);
  if (!/^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const chunk = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of chunk) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** Returns the normalised account number (digits, or a valid IBAN) or null. */
export function normalizeAccountNumber(value: string): string | null {
  const compact = compactBankValue(value);
  if (/^PK/.test(compact)) return isValidPakistanIban(compact) ? compact : null;
  if (!/^\d{6,24}$/.test(compact)) return null;
  if (/^0+$/.test(compact)) return null;
  return compact;
}

/** For logs, notifications and audit views: never show more than the last 4 characters. */
export function maskAccount(value: string | null | undefined): string {
  const compact = compactBankValue(value || "");
  if (!compact) return "—";
  return `••••${compact.slice(-4)}`;
}
