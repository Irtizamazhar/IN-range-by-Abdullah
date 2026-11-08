import { NextResponse } from "next/server";
import { seoHomepageCategories } from "@/lib/seo-data";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await seoHomepageCategories());
}
