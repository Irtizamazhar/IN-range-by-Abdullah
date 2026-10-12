export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { loadMergedNewArrivalCards } from "@/lib/new-arrivals-catalog";

/** Query: `limit` (default 6, max 48), `offset` (default 0). Returns ProductCard-shaped items + total count. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      48,
      Math.max(1, parseInt(searchParams.get("limit") || "6", 10))
    );
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const merged = await loadMergedNewArrivalCards({ search: "", category: "" });
    const total = merged.length;
    const slice = merged.slice(offset, offset + limit);
    // createdAt lets the card show a "New" tag; undated JSON items (epoch) get none.
    const cards = slice.map(({ createdAtTs, ...card }) => (createdAtTs > 0 ? { ...card, createdAt: new Date(createdAtTs).toISOString() } : card));

    return NextResponse.json({ products: cards, total, offset, limit });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load new arrivals" },
      { status: 500 }
    );
  }
}
