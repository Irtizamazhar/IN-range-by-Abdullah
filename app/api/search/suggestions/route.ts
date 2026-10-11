import { NextRequest, NextResponse } from "next/server";
import { normalizeSearchQuery, searchPublicMarketplace } from "@/lib/public-search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = normalizeSearchQuery(request.nextUrl.searchParams.get("q") || "");
  if (query.length < 2) return NextResponse.json({ items: [] });
  try {
    const items = await searchPublicMarketplace(query, 3);
    return NextResponse.json({ items: items.slice(0, 12) });
  } catch (error) {
    console.error("Search suggestions failed", error);
    return NextResponse.json({ items: [], error: "Suggestions unavailable" }, { status: 503 });
  }
}
