import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { readCategories, writeCategories } from "@/lib/categories-store";

export const dynamic = "force-dynamic";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isFinite(id) ? id : NaN;
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idRaw } = await ctx.params;
  const id = parseId(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      image?: string;
      showOnHome?: boolean;
    };

    const categories = await readCategories();
    const idx = categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const name =
      body.name !== undefined ? String(body.name).trim() : categories[idx].name;
    const image =
      body.image !== undefined ? String(body.image).trim() : categories[idx].image;
    if (!name || !image) {
      return NextResponse.json(
        { error: "Name and image are required" },
        { status: 400 }
      );
    }

    categories[idx] = {
      ...categories[idx],
      name,
      image,
      showOnHome: body.showOnHome !== undefined ? body.showOnHome === true : categories[idx].showOnHome !== false,
    };
    await writeCategories(categories);
    return NextResponse.json(categories[idx]);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idRaw } = await ctx.params;
  const id = parseId(idRaw);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const categories = await readCategories();
    const next = categories.filter((c) => c.id !== id);
    if (next.length === categories.length) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    await writeCategories(next);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete category" },
      { status: 500 }
    );
  }
}
