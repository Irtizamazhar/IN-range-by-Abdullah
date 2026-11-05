import { loadSitemapIndex } from "@/lib/seo-sitemap";
import { isMaintenanceMode } from "@/lib/private-launch/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (isMaintenanceMode()) throw new Error("Maintenance");
    return new Response(await loadSitemapIndex(), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=60" } });
  } catch {
    return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
}
