import type { FormEvent, KeyboardEvent } from "react";

/** PKR amounts are entered as whole rupees: drop any decimal part, sign or exponent from a typed or pasted value. */
export function wholeNumber(value: string) {
  return value.split(".")[0].replace(/\D/g, "");
}

/** Stops the keys that would put a decimal point, exponent or sign into a number input. */
export function blockNonDigitKeys(event: KeyboardEvent<HTMLInputElement>) {
  if ([".", ",", "e", "E", "+", "-"].includes(event.key)) event.preventDefault();
}

/** For uncontrolled inputs (defaultValue): cleans pasted values in place. */
export function keepWholeNumber(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const clean = wholeNumber(input.value);
  if (clean !== input.value) input.value = clean;
}

/** Spread onto an uncontrolled PKR amount input. Controlled inputs use `onKeyDown` plus `wholeNumber` in onChange. */
export const wholeNumberInputProps = {
  step: 1,
  inputMode: "numeric" as const,
  onKeyDown: blockNonDigitKeys,
  onInput: keepWholeNumber,
};
