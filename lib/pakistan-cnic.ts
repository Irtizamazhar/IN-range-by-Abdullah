export const MAX_PAKISTAN_CNIC_LENGTH = 15;

export const PAKISTAN_CNIC_FORMAT_ERROR = "Use 00000-0000000-0.";

/**
 * Format-plausibility checks only. A CNIC that passes is NOT proof of identity: it only rules out
 * values that cannot be real. First digit = province/region code; published codes are 1–8
 * (1 KP, 2 ex-FATA, 3 Punjab, 4 Sindh, 5 Balochistan, 6 Islamabad, 7 Gilgit-Baltistan, 8 AJK).
 */
export function cnicDigits(value: string): string | null {
  const input = value.trim();
  if (!/^\d{5}-?\d{7}-?\d$/.test(input) && !/^\d{5} \d{7} \d$/.test(input)) return null;
  return input.replace(/[ -]/g, "");
}

export function cnicPlausibilityError(value: string): string | null {
  const digits = cnicDigits(value);
  if (!digits) return PAKISTAN_CNIC_FORMAT_ERROR;
  if (/^(\d)\1{12}$/.test(digits)) return "Enter your real CNIC number.";
  if (!/^[1-8]/.test(digits)) return "This CNIC number is not valid. The first digit must be 1–8.";
  if (digits.slice(5, 12) === "0000000") return "This CNIC number is not valid.";
  if (digits === "1234567890123") return "Enter your real CNIC number.";
  return null;
}

/** Canonical stored form 00000-0000000-0, or null when the value fails format/plausibility checks. */
export function normalizePakistanCnic(value: string): string | null {
  if (cnicPlausibilityError(value)) return null;
  const digits = cnicDigits(value)!;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/** Add CNIC separators and cap at thirteen digits while keeping invalid input visible. */
export function formatPakistanCnicInput(value: string): string {
  const input = value.trim();
  if (!input) return "";
  if (!/^\d[\d -]*$/.test(input)) return value;

  const digits = input.replace(/[ -]/g, "");
  return [digits.slice(0, 5), digits.slice(5, 12), digits.slice(12, 13)]
    .filter(Boolean)
    .join("-");
}
