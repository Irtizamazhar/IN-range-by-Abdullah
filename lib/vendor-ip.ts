import type { NextRequest } from "next/server";

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 45);
  return "unknown";
}
