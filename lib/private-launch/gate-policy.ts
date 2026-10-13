/**
 * Private launch gate — request policy for visitors WITHOUT a preview session.
 * Pure and edge-safe so middleware and tests share one definition.
 *
 * - "allow":   static assets and the endpoints the Coming Soon page needs.
 * - "gate":    page navigations, answered with the Coming Soon page.
 * - "block":   APIs, server actions and every non-GET request (503 JSON).
 */
export const PRIVATE_LAUNCH_PAGE_PATH = "/private-launch";

export type GateDecision = "allow" | "gate" | "block";

/** Public files under /public (images, fonts, video, manifests). Never /api. */
const STATIC_FILE_PATTERN =
  /\.(?:avif|gif|ico|jpe?g|png|svg|webp|bmp|woff2?|ttf|otf|eot|css|js|map|mp4|webm|txt|xml|webmanifest)$/i;

/**
 * Folders that exist under /public. Restricting extensions to these (or to
 * top-level files) stops URLs like /stores/x.png reaching dynamic pages.
 */
const PUBLIC_ASSET_PREFIXES = ["/branding/", "/payments/", "/uploads/", "/videos/"];

function isPublicAssetPath(pathname: string) {
  if (!STATIC_FILE_PATTERN.test(pathname)) return false;
  const isTopLevelFile = pathname.lastIndexOf("/") === 0;
  return isTopLevelFile || PUBLIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Always reachable while gated (matched exactly, with the listed methods). */
const PUBLIC_ENDPOINTS: Record<string, readonly string[]> = {
  "/api/preview-access/login": ["POST"],
  "/api/preview-access/logout": ["POST"],
  // next-auth's SessionProvider polls this from the root layout; it only ever
  // returns the caller's own session (empty for public visitors).
  "/api/auth/session": ["GET"],
};

export function decideGatedRequest(input: {
  pathname: string;
  method: string;
  isServerAction?: boolean;
}): GateDecision {
  const pathname = input.pathname;
  const method = input.method.toUpperCase();

  const publicMethods = PUBLIC_ENDPOINTS[pathname];
  if (publicMethods) return publicMethods.includes(method) ? "allow" : "block";

  if (pathname.startsWith("/_next/static/") || pathname.startsWith("/_next/image")) {
    return method === "GET" || method === "HEAD" ? "allow" : "block";
  }

  const isApi = pathname === "/api" || pathname.startsWith("/api/");
  if (isApi || input.isServerAction) return "block";
  if (method !== "GET" && method !== "HEAD") return "block";

  if (isPublicAssetPath(pathname)) return "allow";
  return "gate";
}
