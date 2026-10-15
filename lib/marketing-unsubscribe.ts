import { createHmac, timingSafeEqual } from "node:crypto";

export type MarketingRecipientType = "customer" | "vendor";

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET?.trim();
  if (!value) throw new Error("NEXTAUTH_SECRET is required for marketing links.");
  return value;
}

export function createMarketingUnsubscribeToken(type: MarketingRecipientType, id: string): string {
  const payload = `${type}.${id}`;
  const signature = createHmac("sha256", secret()).update(`joro-marketing-unsubscribe:${payload}`).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyMarketingUnsubscribeToken(token: string): { type: MarketingRecipientType; id: string } | null {
  const match = /^(customer|vendor)\.([a-z0-9]{10,40})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return null;
  const expected = createMarketingUnsubscribeToken(match[1] as MarketingRecipientType, match[2]);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { type: match[1] as MarketingRecipientType, id: match[2] };
}
