/**
 * Public URL of the admin panel, configured with the server-only ADMIN_SECRET_PATH
 * (e.g. "/your-admin-path"). Pages still live under app/admin; middleware rewrites the
 * secret path onto them and answers the old /admin URLs with a 404.
 *
 * Server and middleware only: never import this from a client component, or the
 * path would be bundled into public JavaScript. Admin client components receive it
 * from app/admin/layout.tsx through AdminPathProvider instead.
 */

/** Folder the admin pages are served from internally. */
export const ADMIN_INTERNAL_BASE = "/admin";

const ADMIN_PATH_PATTERN = /^\/[a-z0-9][a-z0-9-]{6,62}[a-z0-9]$/;

/** Top-level segments of existing site routes; the admin path must not shadow them. */
const RESERVED_SEGMENTS = new Set([
  "admin", "api", "_next", "uploads", "fonts", "login", "marketing", "private-launch",
  "public-home", "sell", "vendor", "about", "account", "cart", "checkout", "deals", "faq",
  "gifts", "invoice", "join", "joined-requests", "joro-connect", "my-stuff", "myhome",
  "new-arrivals", "products", "reset-password", "return-policy", "reviews", "search",
  "services", "stores", "together", "track-order", "wants", "privacy-policy",
  "terms-and-conditions", "branding", "payments", "videos", "categories", "sitemaps",
]);

/** Validated admin base path, or null when unset/invalid (the admin panel then 404s). */
export function adminBasePath(value: string | undefined = process.env.ADMIN_SECRET_PATH): string | null {
  const path = value?.trim().toLowerCase().replace(/\/+$/, "");
  if (!path || !ADMIN_PATH_PATTERN.test(path)) return null;
  return RESERVED_SEGMENTS.has(path.slice(1)) ? null : path;
}

function startsWithSegment(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(base + "/");
}

/** True for /admin and /admin/* — the retired public URLs. */
export function isInternalAdminPath(pathname: string) {
  return startsWithSegment(pathname, ADMIN_INTERNAL_BASE);
}

/** Maps "/<secret>/orders" to "/admin/orders"; null when the path is not under the secret base. */
export function toInternalAdminPath(pathname: string, base: string | null): string | null {
  if (!base || !startsWithSegment(pathname, base)) return null;
  return ADMIN_INTERNAL_BASE + pathname.slice(base.length);
}

/** Public admin URL for a sub-path such as "/orders" ("" for the panel root). */
export function adminUrl(subPath = "", base: string | null = adminBasePath()) {
  return base ? base + subPath : null;
}
