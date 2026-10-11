import { NextResponse } from "next/server";
import { readActiveProductCategories } from "@/lib/categories-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await readActiveProductCategories();
  return NextResponse.json(rows.map(({ id, name }) => ({ id, name })));
}
