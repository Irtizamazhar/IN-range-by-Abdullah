/**
 * Name comparison used to flag a bank account title that does not match the owner's CNIC name.
 * Tolerates spelling variants (Muhammad/Mohammad, Syed/Sayyed, Ahmed/Ahmad), spacing and punctuation.
 */
/** Minimum similarity (0–1) for two names to be treated as the same person. */
export const NAME_MATCH_THRESHOLD = 0.85;

const NAME_VARIANTS: Array<[RegExp, string]> = [
  [/^(M|MD|MOHD|MUHD|MOHAMMAD|MOHAMMED|MOHAMED|MUHAMMED|MUHAMAD|MOHAMAD|MUHAMMMAD|MUHAMMAD)$/, "MUHAMMAD"],
  [/^(SYED|SAYYED|SAYED|SYYED|SYYAD|SAYYID)$/, "SYED"],
  [/^(AHMED|AHMAD|AHMET)$/, "AHMAD"],
];

export function normalizeNameForMatch(value: string): string[] {
  const ascii = value.normalize("NFKD").replace(new RegExp("\\p{M}", "gu"), "").toUpperCase();
  return ascii.replace(/[^A-Z]+/g, " ").trim().split(" ").filter(Boolean)
    .map(token => NAME_VARIANTS.find(([pattern]) => pattern.test(token))?.[1] ?? token);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

function ratio(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest ? 1 - levenshtein(a, b) / longest : 0;
}

/** 0–1 similarity: best of joined-letters and token-sorted comparisons (handles "ZIA UL HAQ"/"ZIAULHAQ"). */
export function nameSimilarity(entered: string, extracted: string): number {
  const a = normalizeNameForMatch(entered), b = normalizeNameForMatch(extracted);
  if (!a.length || !b.length) return 0;
  return Math.max(ratio(a.join(""), b.join("")), ratio([...a].sort().join(" "), [...b].sort().join(" ")));
}
