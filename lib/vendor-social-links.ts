import { z } from "zod";

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "website", "whatsapp"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialLinks = Partial<Record<SocialPlatform, string>>;

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", website: "Website", whatsapp: "WhatsApp",
};

/** Allowed hosts per platform; subdomains (www., m.) are accepted. `website` accepts any public domain. */
const DOMAINS: Record<Exclude<SocialPlatform, "website">, string[]> = {
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
  whatsapp: ["wa.me", "whatsapp.com"],
};

const MAX_URL = 300;

/** Returns the normalized URL, or an error message when it is not an allowed HTTPS link for the platform. */
export function checkSocialUrl(platform: SocialPlatform, raw: string): { url: string } | { error: string } {
  const value = raw.trim();
  if (value.length > MAX_URL) return { error: `Keep the link under ${MAX_URL} characters.` };
  let url: URL;
  try { url = new URL(value); } catch { return { error: "Enter a full link starting with https://" }; }
  if (url.protocol !== "https:") return { error: "Use a secure link starting with https://" };
  if (url.username || url.password) return { error: "Remove the username or password from the link." };
  const host = url.hostname.toLowerCase();
  if (platform === "website") {
    const isIp = /^[\d.]+$/.test(host) || host.includes(":");
    if (isIp || !host.includes(".") || host === "localhost" || host.endsWith(".local")) return { error: "Enter a public website address." };
  } else if (!DOMAINS[platform].some(domain => host === domain || host.endsWith(`.${domain}`))) {
    return { error: `${SOCIAL_LABELS[platform]} links must be on ${DOMAINS[platform].join(" or ")}.` };
  }
  return { url: url.toString() };
}

/** Server-side input: every platform optional; blank means "remove". */
export const socialLinksInputSchema = z.object(Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p, z.string().max(MAX_URL + 50).optional()])) as Record<SocialPlatform, z.ZodOptional<z.ZodString>>)
  .strict()
  .transform((input, ctx) => {
    const links: SocialLinks = {};
    for (const platform of SOCIAL_PLATFORMS) {
      const value = input[platform]?.trim();
      if (!value) continue;
      const checked = checkSocialUrl(platform, value);
      if ("error" in checked) ctx.addIssue({ code: "custom", path: [platform], message: checked.error });
      else links[platform] = checked.url;
    }
    return links;
  });

/** Reads stored JSON defensively: only valid links are ever rendered publicly. */
export function readSocialLinks(stored: unknown): SocialLinks {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const links: SocialLinks = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const value = (stored as Record<string, unknown>)[platform];
    if (typeof value !== "string") continue;
    const checked = checkSocialUrl(platform, value);
    if ("url" in checked) links[platform] = checked.url;
  }
  return links;
}
