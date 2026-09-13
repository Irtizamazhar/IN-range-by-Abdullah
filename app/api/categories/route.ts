import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import {
  nextCategoryId,
  readCategories,
  type ShopCategory,
  writeCategories,
} from "@/lib/categories-store";

export const dynamic = "force-dynamic";
const DEFAULT_CATEGORY_IMAGE = "/uploads/categories/default-category.jpg";

export async function GET() {
  try {
    const categories = await readCategories();
    return NextResponse.json(categories);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load categories" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminPermission("catalog.manage");
  if ("response" in auth) return auth.response;

  try {
    const body = (await req.json()) as Partial<ShopCategory>;
    const name = String(body.name || "").trim();
    const image = String(body.image || "").trim() || DEFAULT_CATEGORY_IMAGE;
    const showOnHome = body.showOnHome === true;

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }
    const categories = await readCategories();
    const existing = categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      return NextResponse.json(existing);
    }
    const next: ShopCategory = {
      id: nextCategoryId(categories),
      name,
      image,
      showOnHome,
    };
    const updated = [...categories, next];
    await writeCategories(updated);
    return NextResponse.json(next, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add category" },
      { status: 500 }
    );
  }
}
