export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  id: z.string().min(1),
  commissionPercentage: z.number().min(0).max(100),
});

export async function GET() {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.commissionSetting.findMany({
    orderBy: { categoryName: "asc" },
  });

  return NextResponse.json({
    categories: rows.map((r) => ({
      id: r.id,
      categoryName: r.categoryName,
      commissionPercentage: Number(r.commissionPercentage),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.commissionSetting.update({
      where: { id: parsed.data.id },
      data: {
        commissionPercentage: new Prisma.Decimal(
          parsed.data.commissionPercentage.toFixed(2)
        ),
      },
    });
    return NextResponse.json({
      ok: true,
      category: {
        id: updated.id,
        categoryName: updated.categoryName,
        commissionPercentage: Number(updated.commissionPercentage),
      },
    });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}
