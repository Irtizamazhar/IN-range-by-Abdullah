export const MAX_PAKISTAN_CNIC_LENGTH = 15;

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
