import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth-cookies";
import { VENDOR_JWT_COOKIE } from "@/lib/vendor-cookies";
import { resolveVendorJwtSecretKey } from "@/lib/vendor-jwt-secret";
import { PRIVATE_LAUNCH_PAGE_PATH, decideGatedRequest } from "@/lib/private-launch/gate-policy";
import {
  PREVIEW_SESSION_COOKIE,
  isMaintenanceMode,
  verifyPreviewSessionToken,
} from "@/lib/private-launch/session";

function vendorJwtSecretKey() {
  return resolveVendorJwtSecretKey();
}

/** Keeps gated and team-only responses out of shared caches and search engines. */
function markPrivate(res: NextResponse) {
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

/**
 * Private launch gate. Returns a response for visitors without a valid team
 * preview session, or null to let an authorized team member continue to the
 * regular checks below (admin/vendor authorization stays enforced).
 */
async function privateLaunchGate(req: NextRequest): Promise<NextResponse | null> {
  const path = req.nextUrl.pathname;
  const member = await verifyPreviewSessionToken(req.cookies.get(PREVIEW_SESSION_COOKIE)?.value);

  if (member) {
    return path === PRIVATE_LAUNCH_PAGE_PATH ? NextResponse.redirect(new URL("/", req.url)) : null;
  }

  const decision = decideGatedRequest({
    pathname: path,
    method: req.method,
    isServerAction: req.headers.has("next-action"),
  });
  if (decision === "allow") return NextResponse.next();
  if (decision === "home") {
    return NextResponse.rewrite(new URL("/public-home", req.url));
  }
  if (decision === "block") {
    return markPrivate(
      NextResponse.json(
        { error: "JORO is in private launch. Please check back soon." },
        { status: 503, headers: { "Retry-After": "3600" } },
      ),
    );
  }
  return markPrivate(
    path === PRIVATE_LAUNCH_PAGE_PATH
      ? NextResponse.next()
      : NextResponse.rewrite(new URL(PRIVATE_LAUNCH_PAGE_PATH, req.url)),
  );
}

async function authorizeArea(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/vendor/dashboard")) {
    const secret = vendorJwtSecretKey();
    const token = req.cookies.get(VENDOR_JWT_COOKIE)?.value;

    if (!secret || !token) {
      return NextResponse.redirect(new URL("/vendor/login", req.url));
    }
    // Edge middleware can be sensitive to env/crypto differences during local dev.
    // We only gate on cookie presence here; full token + DB-session verification is
    // performed server-side in vendor dashboard/layout via getVendorFromSession().
    return NextResponse.next();
  }

  if (path.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  if (path.startsWith("/admin")) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET!,
      cookieName: ADMIN_SESSION_COOKIE,
    });
    return !token || (token as { role?: string }).role !== "admin"
      ? NextResponse.redirect(new URL("/admin/login", req.url))
      : NextResponse.next();
  }

  return NextResponse.next();
}

export async function middleware(req: NextRequest) {
  if (!isMaintenanceMode()) return authorizeArea(req);

  const gated = await privateLaunchGate(req);
  if (gated) return gated;
  return markPrivate(await authorizeArea(req));
}

export const config = {
  // Every request except Next.js build assets; the gate policy decides the rest.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
