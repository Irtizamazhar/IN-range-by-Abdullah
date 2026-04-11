export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string } };

function scopeFromUrl(url: string) {
  const s = new URL(url).searchParams.get("scope");
  return s === "newArrival" ? "newArrival" : "product";
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(ctx.params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const scope = scopeFromUrl(req.url);

  let body: { approved?: boolean };
  try {
    body = (await req.json()) as { approved?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "approved boolean required" }, { status: 400 });
  }

  try {
    if (scope === "newArrival") {
      const updated = await prisma.newArrivalReview.update({
        where: { id },
        data: { approved: body.approved },
      });
      return NextResponse.json({
        ok: true,
        review: {
          id: updated.id,
          approved: updated.approved,
          productName: `New arrival #${updated.newArrivalId}`,
        },
      });
    }

    const updated = await prisma.review.update({
      where: { id },
      data: { approved: body.approved },
      include: { product: { select: { name: true } } },
    });
    return NextResponse.json({
      ok: true,
      review: {
        id: updated.id,
        approved: updated.approved,
        productName: updated.product.name,
      },
    });
  } catch {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(ctx.params.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const scope = scopeFromUrl(req.url);

  try {
    if (scope === "newArrival") {
      await prisma.newArrivalReview.delete({ where: { id } });
    } else {
      await prisma.review.delete({ where: { id } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
}
