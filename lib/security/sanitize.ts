import sanitizeHtml from "sanitize-html";

/** Plain text only — strips all HTML/tags (XSS-safe for names, titles, etc.). */
export function sanitizePlainText(input: unknown, maxLen = 10_000): string {
  const s = typeof input === "string" ? input.slice(0, maxLen) : "";
  return sanitizeHtml(s, {
    allowedTags: [],
    allowedAttributes: {},
  })
    // sanitize-html re-escapes "&" as "&amp;", which was stored and shown literally ("Hangers &amp; Hooks").
    // React escapes text on render, so restore it. "&lt;"/"&gt;" stay encoded, so no tag can ever come back.
    .replace(/&amp;/g, "&")
    .trim();
}

/** Limited rich text for descriptions (vendor products, etc.). Tighten further if needed. */
export function sanitizeDescriptionHtml(input: unknown, maxLen = 50_000): string {
  const s = typeof input === "string" ? input.slice(0, maxLen) : "";
  return sanitizeHtml(s, {
    allowedTags: [
      "b",
      "i",
      "em",
      "strong",
      "p",
      "br",
      "ul",
      "ol",
      "li",
    ],
    allowedAttributes: {},
  }).trim();
}
