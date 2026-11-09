/**
 * Person-name rules shared by the browser and every API that stores a person's name.
 *
 * Accepts any script (Latin, Urdu/Arabic, …) via Unicode letter/mark classes so genuine
 * Urdu and international names pass. Rejects digits, symbols, numeric-only and
 * clearly placeholder values.
 */
export const PERSON_NAME_MAX = 100;

// RegExp constructors (not literals) because the project's TypeScript target predates the u flag.
const NAME_CHARS = new RegExp("^[\\p{L}\\p{M}][\\p{L}\\p{M} .'’-]*$", "u");
const LETTER = new RegExp("\\p{L}", "gu");
const DIGIT = new RegExp("\\p{Nd}", "u");

export function normalizePersonName(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Returns a user-facing error, or null when the value is an acceptable person name. */
export function personNameError(raw: unknown, label = "Name"): string | null {
  const value = typeof raw === "string" ? normalizePersonName(raw) : "";
  if (!value) return `${label} is required.`;
  if (value.length > PERSON_NAME_MAX) return `${label} must be ${PERSON_NAME_MAX} characters or fewer.`;
  if (DIGIT.test(value)) return `${label} cannot contain numbers.`;
  if (!NAME_CHARS.test(value)) return `${label} can only use letters, spaces, hyphens, apostrophes and full stops.`;
  if (/[.'’-]{2,}/.test(value) || /[.'’-]\s*[.'’-]/.test(value)) return `${label} has too many punctuation marks.`;
  const letters = value.match(LETTER) || [];
  if (letters.length < 2) return `Enter a complete ${label.toLowerCase()}.`;
  const lettersOnly = letters.join("").toLowerCase();
  if (lettersOnly.length >= 3 && new Set(lettersOnly).size === 1) return `Enter a real ${label.toLowerCase()}.`;
  return null;
}

/**
 * Bank account titles may be a business ("Khan Traders (Pvt) Ltd", "A & B Co. 2"), so digits and a
 * few business symbols are allowed, but a title must still be mostly letters and never numeric-only.
 */
const TITLE_CHARS = new RegExp("^[\\p{L}\\p{M}\\p{Nd} .,'’&()/-]+$", "u");

export function accountTitleError(raw: unknown): string | null {
  const value = typeof raw === "string" ? normalizePersonName(raw) : "";
  if (!value) return "Account title is required.";
  if (value.length > 200) return "Account title must be 200 characters or fewer.";
  if (!TITLE_CHARS.test(value)) return "Account title can only use letters, numbers, spaces and . , ' & ( ) / -";
  const letters = (value.match(LETTER) || []).length;
  if (letters < 2) return "Enter the account title exactly as it appears on your bank account.";
  const symbols = (value.match(/[.,'’&()\/-]/g) || []).length;
  if (symbols > Math.max(3, Math.floor(letters / 3))) return "Account title has too many symbols.";
  return null;
}

