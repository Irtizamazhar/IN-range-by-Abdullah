/** UI-only formatting. API/storage values retain the existing 03XX-XXXXXXX contract. */
export function pakistanNationalDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function formatPakistanNational(value: string): string {
  const digits = pakistanNationalDigits(value);
  return digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
}

export function pakistanMobileStorageValue(national: string): string {
  const digits = pakistanNationalDigits(national);
  return digits ? `0${formatPakistanNational(digits)}` : "";
}

export function mobileCaretPosition(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let count = 0;
  for (let index = 0; index < formatted.length; index++) if (/\d/.test(formatted[index]) && ++count === digitCount) return index + 1;
  return formatted.length;
}
