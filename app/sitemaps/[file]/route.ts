import { loadSitemapPage, sitemapUrls, STATIC_SEO_PATHS, SITEMAP_KINDS, type SitemapKind } from "@/lib/seo-sitemap";
import { absoluteUrl } from "@/lib/seo";
import { isMaintenanceMode } from "@/lib/private-launch/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { file: string } }) {
  try {
    if (isMaintenanceMode()) throw new Error("Maintenance");
    const match = /^(products|categories|services|stores|wants)-(0|[1-9][0-9]{0,5})\.xml$/.exec(params.file);
    const xml = params.file === "static-0.xml" ? sitemapUrls(STATIC_SEO_PATHS.map(path => ({ url: absoluteUrl(path) })))
      : match && SITEMAP_KINDS.includes(match[1] as SitemapKind) ? await loadSitemapPage(match[1] as SitemapKind, Number(match[2])) : null;
    return xml ? new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=60" } })
      : new Response("Sitemap not found", { status: 404 });
  } catch {
    return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
}
