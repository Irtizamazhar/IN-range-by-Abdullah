/** Collapse duplicated halves like "First Last First Last" stored in `ownerName`. */
export function vendorWelcomeDisplayName(ownerName: string): string {
  const t = ownerName.trim().replace(/\s+/g, " ");
  const parts = t.split(" ");
  if (parts.length >= 2 && parts.length % 2 === 0) {
    const half = parts.length / 2;
    const a = parts.slice(0, half).join(" ");
    const b = parts.slice(half).join(" ");
    if (a === b) return a;
  }
  return t;
}
