export const PAKISTAN_MOBILE_ERROR =
  "Enter a valid Pakistani mobile number, e.g. 0300-1234567 or +92 300 1234567.";

/** Add separators and cap supported mobile digits while keeping invalid input visible. */
export function formatPakistanMobileInput(value: string): string {
  const input = value.trim();
  if (!input) return "";
  if (!/^\+?(?:\d[\d -]*)?$/.test(input)) return value;

  const digits = input.replace(/[ -]/g, "");
  if (!digits) return value;

  if (digits.startsWith("03")) {
    return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4, 11)}` : digits;
  }

  const countryPrefixes = ["+92", "0092", "92"];
  const countryPrefix = countryPrefixes.find(prefix => digits.startsWith(prefix));
  if (countryPrefix) {
    const mobile = digits.slice(countryPrefix.length);
    if (mobile && !mobile.startsWith("3")) return value;
    return [countryPrefix, mobile.slice(0, 3), mobile.slice(3, 10)].filter(Boolean).join("-");
  }

  // Keep unfinished country/local prefixes editable; never add a trailing separator.
  if (["03", ...countryPrefixes].some(prefix => prefix.startsWith(digits))) return digits;
  return value;
}

/** Maximum displayed length, including automatic dashes, for the current prefix. */
export function pakistanMobileInputMaxLength(value: string): number {
  const input = value.trim();
  if (!/^\+?(?:\d[\d -]*)?$/.test(input)) return 16;

  const digits = input.replace(/[ -]/g, "");
  if (digits.startsWith("03")) return 12;
  if (/^\+92(?:3|$)/.test(digits)) return 15;
  if (/^92(?:3|$)/.test(digits)) return 14;
  return 16;
}

/** Accept local/international input and keep the existing local storage format. */
export function normalizePakistanMobile(value: string): string | null {
  const input = value.trim();

  // Reject unsupported characters instead of stripping letters, extensions or extra plus signs.
  if (input.length > 40 || !/^\+?\d[\d -]*\d$/.test(input)) return null;

  const digits = input.replace(/[ -]/g, "");
  if (!/^(?:03\d{9}|(?:\+92|0092|92)3\d{9})$/.test(digits)) return null;

  const local = digits.replace(/^(?:\+92|0092|92)/, "0");
  return `${local.slice(0, 4)}-${local.slice(4)}`;
}
