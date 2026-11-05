import { SITE_URL } from "@/lib/seo";
import { ROBOTS_DISALLOW } from "@/lib/seo-policy";
import { isMaintenanceMode } from "@/lib/private-launch/session";
export const dynamic = "force-dynamic";
export async function GET() {
  const body = isMaintenanceMode() ? "User-agent: *\nDisallow: /\n" : ["User-agent: *", "Allow: /", "Allow: /api/image/", "Allow: /api/uploads/", "Allow: /_next/image", ...ROBOTS_DISALLOW.map(path => `Disallow: ${path}`), `Sitemap: ${SITE_URL}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=60" } });
}
