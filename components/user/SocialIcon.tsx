import { Globe } from "lucide-react";
import type { SocialPlatform } from "@/lib/vendor-social-links";

/** Simple monochrome platform marks (lucide no longer ships brand icons). They inherit currentColor. */
export function SocialIcon({ platform, className = "h-5 w-5" }: { platform: SocialPlatform; className?: string }) {
  if (platform === "website") return <Globe className={className} aria-hidden="true" />;
  const common = { className, viewBox: "0 0 24 24", "aria-hidden": true, fill: "currentColor" } as const;
  if (platform === "facebook") return <svg {...common}><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4A21 21 0 0 0 14.3 4c-2.3 0-3.8 1.4-3.8 4v2.5H8v3h2.5V21h3Z" /></svg>;
  if (platform === "instagram") return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" /></svg>;
  if (platform === "tiktok") return <svg {...common}><path d="M16.6 3c.3 2.2 1.6 3.6 3.9 3.8v3.1a7.4 7.4 0 0 1-3.8-1.2v6.1c0 3.4-2.4 5.9-5.8 5.9a5.6 5.6 0 0 1-5.8-5.6c0-3.6 3.1-6 6.6-5.5v3.2c-1.6-.4-3.4.5-3.4 2.3 0 1.4 1.1 2.4 2.5 2.4 1.6 0 2.6-1 2.6-2.9V3h3.2Z" /></svg>;
  if (platform === "youtube") return <svg {...common}><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" /></svg>;
  return <svg {...common}><path d="M12 2.5a9.4 9.4 0 0 0-8.1 14.2L2.5 21.5l4.9-1.3A9.4 9.4 0 1 0 12 2.5Zm0 17.1c-1.4 0-2.8-.4-4-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A7.7 7.7 0 1 1 12 19.6Zm4.2-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.3 6.3 0 0 1-3.1-2.7c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.8 2c0 1.2.9 2.3 1 2.5.1.2 1.7 2.7 4.2 3.7 1.6.6 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2l-.1-.5Z" /></svg>;
}
