export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";
import { readCategories } from "@/lib/categories-store";

const patchSchema = z.object({
  id: z.string().min(1),
  commissionPercentage: z.number().min(0).max(100),
});

export async function GET() {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [rows, storeCategories] = await Promise.all([
    prisma.commissionSetting.findMany(),
    readCategories(),
  ]);
  const mainCategoryNames = Array.from(
    new Set(
      storeCategories
        .map((c) => String(c.name || "").trim())
        .filter(Boolean)
    )
  );

  const globalRow = rows.find(
    (r) => r.categoryName.trim().toLowerCase() === "global"
  );
  const fallbackRate = globalRow ? Number(globalRow.commissionPercentage) : 10;
  const byName = new Map(rows.map((r) => [r.categoryName.trim().toLowerCase(), r]));

  const missingNames = mainCategoryNames.filter(
    (name) => !byName.has(name.toLowerCase())
  );
  if (missingNames.length > 0) {
    await prisma.$transaction(
      missingNames.map((name) =>
        prisma.commissionSetting.upsert({
          where: { categoryName: name },
          create: {
            categoryName: name,
            commissionPercentage: new Prisma.Decimal(fallbackRate.toFixed(2)),
          },
          update: {},
        })
      )
    );
    const refreshed = await prisma.commissionSetting.findMany({
      where: { categoryName: { in: mainCategoryNames } },
    });
    refreshed.forEach((row) => byName.set(row.categoryName.trim().toLowerCase(), row));
  }

  const orderedRows = mainCategoryNames
    .map((name) => byName.get(name.toLowerCase()))
    .filter((row): row is NonNullable<typeof row> => row != null);

  return NextResponse.json({
    categories: orderedRows.map((r) => ({
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
