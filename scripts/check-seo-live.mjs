// Read-only public HTTP observations; never uses credentials or mutates production settings.
import fs from "node:fs";
const attr = (tag, key) => tag.match(new RegExp(`\\b${key}=["']([^"']*)["']`, "i"))?.[1];
const rows = await Promise.all(["https://joro.pk/", "https://joro.pk/sitemap.xml", "https://joro.pk/robots.txt", "https://www.joro.pk/", "http://joro.pk/", "http://www.joro.pk/"].map(async start => {
  let url = start; const chain = [];
  try {
    for (let i = 0; i < 5; i++) {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
      chain.push({ url, status: response.status, location: response.headers.get("location"), robots: response.headers.get("x-robots-tag") });
      if (response.status >= 300 && response.status < 400 && response.headers.has("location")) { url = new URL(response.headers.get("location"), url).href; await response.body?.cancel(); continue; }
      const body = await response.text();
      const tags = body.match(/<(?:meta|link)\b[^>]*>/gi) || [];
      return { start, chain, contentType: response.headers.get("content-type"), title: body.match(/<title[^>]*>(.*?)<\/title>/is)?.[1],
        canonical: attr(tags.find(tag => attr(tag, "rel") === "canonical") || "", "href"),
        metaRobots: attr(tags.find(tag => attr(tag, "name") === "robots") || "", "content"), bytes: body.length };
    }
    return { start, chain, error: "redirect-limit" };
  } catch { return { start, chain, error: "network-unavailable" }; }
}));
fs.mkdirSync("node_modules/.cache/joro-seo", { recursive: true });
fs.writeFileSync("node_modules/.cache/joro-seo/live-before.json", JSON.stringify({ checkedAt: new Date().toISOString(), rows }, null, 2));
console.log(JSON.stringify(rows, null, 2));
