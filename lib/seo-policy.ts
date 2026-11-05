/** Edge-safe, public policy. Never includes the configured private admin prefix. */
export function shouldNoindex(path: string, query: URLSearchParams): boolean {
  if (/^\/(?:account|vendor|cart|checkout|login|reset-password|search|invoice|track-order|together|join|marketing|my-stuff|sell|myhome|deals|private-launch|public-home)(?:\/|$)/.test(path)) return true;
  if (path.startsWith("/api/") && !/^\/api\/(?:image|uploads)\//.test(path)) return true;
  if (Array.from(query.keys()).some(key => !["page", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"].includes(key))) return true;
  return false;
}
// Keep HTML crawlable so Google can observe its noindex directive; auth protects private data.
export const ROBOTS_DISALLOW = ["/api/"];
