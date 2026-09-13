export function customerServiceSnapshot(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(["name", "warranty", "total", "city", "cancellationTerms", "description", "duration", "coverage"].map(key => [key, typeof source[key] === "string" || typeof source[key] === "number" ? source[key] : ""]));
}