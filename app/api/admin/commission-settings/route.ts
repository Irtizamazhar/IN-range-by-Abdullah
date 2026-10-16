export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { readCategories } from "@/lib/categories-store";
import { giftTerms } from "@/lib/gift-products";

/** Row read by service checkout (`lib/service-checkout-service.ts`). */
const SERVICES_ROW_NAME = "Services";

const patchSchema = z.object({
  id: z.string().min(1),
  commissionPercentage: z.number().min(0).max(100),
});

const createServicesSchema = z.object({
  categoryName: z.literal(SERVICES_ROW_NAME),
  commissionPercentage: z.number().min(0).max(100),
});

export async function GET() {
  const auth = await requireAdminPermission("payments.manage");
  if ("response" in auth) return auth.response;

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

  const servicesRow = byName.get(SERVICES_ROW_NAME.toLowerCase());
  const giftCategoryIds = orderedRows
    .filter((r) => {
      const name = r.categoryName.toLowerCase();
      return giftTerms.some((term) => name.includes(term));
    })
    .map((r) => r.id);

  return NextResponse.json({
    categories: orderedRows.map((r) => ({
      id: r.id,
      categoryName: r.categoryName,
      commissionPercentage: Number(r.commissionPercentage),
      updatedAt: r.updatedAt.toISOString(),
    })),
    services: servicesRow
      ? {
          id: servicesRow.id,
          categoryName: servicesRow.categoryName,
          commissionPercentage: Number(servicesRow.commissionPercentage),
          updatedAt: servicesRow.updatedAt.toISOString(),
        }
      : null,
    giftCategoryIds,
    giftTerms,
  });
}

/** Creates the "Services" row only when it is missing; never overwrites an existing rate. */
export async function POST(req: NextRequest) {
  const auth = await requireAdminPermission("payments.manage");
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createServicesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.commissionSetting.findUnique({
    where: { categoryName: SERVICES_ROW_NAME },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Services commission already exists" },
      { status: 409 }
    );
  }

  try {
    const created = await prisma.commissionSetting.create({
      data: {
        categoryName: SERVICES_ROW_NAME,
        commissionPercentage: new Prisma.Decimal(
          parsed.data.commissionPercentage.toFixed(2)
        ),
      },
    });
    return NextResponse.json({
      ok: true,
      category: {
        id: created.id,
        categoryName: created.categoryName,
        commissionPercentage: Number(created.commissionPercentage),
      },
    });
  } catch {
    return NextResponse.json({ error: "Create failed" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminPermission("payments.manage");
  if ("response" in auth) return auth.response;

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
