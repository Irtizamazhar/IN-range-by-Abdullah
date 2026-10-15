import { ApiError } from "@/lib/marketplace-api";

function configuredOrigins(): Set<string> {
  const result = new Set<string>();
  for (const name of ["NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_SITE_URL", "CANONICAL_HOST", "JORO_PREVIEW_ORIGIN"]) {
    const value = process.env[name]?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) continue;
      if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) continue;
      result.add(url.origin);
    } catch { /* Ignore invalid deployment configuration. */ }
  }
  return result;
}

/** Match the browser origin to an exact configured public host, including proxy rewrites. */
export function customerRegistrationSameOrigin(request: Request) {
  const originHeader = request.headers.get("origin");
  if (!originHeader) return;
  const reject = () => { throw new ApiError(403, "Please refresh and sign up from the official JORO website."); };
  let origin: URL;
  try { origin = new URL(originHeader); } catch { reject(); return; }
  if (origin.origin !== originHeader || origin.pathname !== "/" || origin.search || origin.hash) reject();

  const requestOrigin = new URL(request.url).origin;
  if (origin.origin === requestOrigin && (process.env.NODE_ENV !== "production" || configuredOrigins().has(origin.origin))) return;
  if (!configuredOrigins().has(origin.origin)) reject();

  const samePublicHost = (host: string | null) => host?.toLowerCase() === origin.host.toLowerCase();
  if (samePublicHost(request.headers.get("host"))) return;
  const forwardedHosts = request.headers.get("x-forwarded-host")?.split(",").map(host => host.trim()) || [];
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHosts.length === 1 && samePublicHost(forwardedHosts[0]) && forwardedProto === origin.protocol.slice(0, -1)) return;
  reject();
}
