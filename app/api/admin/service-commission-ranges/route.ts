export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SERVICE_COMMISSION_RANGES,
  MAX_SERVICE_COMMISSION_RANGES,
  validateServiceCommissionRanges,
  type ServiceCommissionRangeInput,
} from "@/lib/service-commission-ranges";

const rangeSchema = z.object({
  minAmount: z.number().finite(),
  maxAmount: z.number().finite(),
  commissionPercentage: z.number().finite(),
  isActive: z.boolean(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    version: z.string(),
    ranges: z.array(rangeSchema).max(MAX_SERVICE_COMMISSION_RANGES),
  }),
  z.object({ action: z.literal("reset"), version: z.string() }),
]);

type RangeRow = Awaited<ReturnType<typeof prisma.serviceCommissionRange.findMany>>[number];

function serialize(rows: RangeRow[]) {
  return rows.map((r) => ({
    id: r.id,
    minAmount: Number(r.minAmount),
    maxAmount: Number(r.maxAmount),
    commissionPercentage: Number(r.commissionPercentage),
    isActive: r.isActive,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Changes whenever any row is added, removed or edited; guards against concurrent admin saves. */
function versionOf(rows: RangeRow[]) {
  const latest = rows.reduce((max, r) => Math.max(max, r.updatedAt.getTime()), 0);
  return `${rows.length}:${latest}:${rows.map((r) => r.id).sort().join(",")}`;
}

async function loadRows(db: Prisma.TransactionClient | typeof prisma) {
  return db.serviceCommissionRange.findMany({ orderBy: [{ sortOrder: "asc" }, { minAmount: "asc" }] });
}

export async function GET() {
  const auth = await requireAdminPermission("payments.manage");
  if ("response" in auth) return auth.response;
  const rows = await loadRows(prisma);
  return NextResponse.json({ ranges: serialize(rows), version: versionOf(rows), defaults: DEFAULT_SERVICE_COMMISSION_RANGES });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdminPermission("payments.manage");
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;
  const ranges: ServiceCommissionRangeInput[] =
    input.action === "reset" ? DEFAULT_SERVICE_COMMISSION_RANGES : input.ranges;

  // Server-side validation is authoritative; the dashboard runs the same rules for inline messages.
  const validation = validateServiceCommissionRanges(ranges);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Fix the highlighted ranges before saving.", rowErrors: validation.rowErrors, errors: validation.errors },
      { status: 400 }
    );
  }

  try {
    const rows = await prisma.$transaction(
      async (tx) => {
        const before = await loadRows(tx);
        if (versionOf(before) !== input.version) {
          throw Object.assign(new Error("STALE"), { stale: true });
        }
        // Bookings snapshot their rate and amount on OrderService, so replacing rows is not retroactive.
        await tx.serviceCommissionRange.deleteMany({});
        await tx.serviceCommissionRange.createMany({
          data: ranges.map((r, index) => ({
            minAmount: new Prisma.Decimal(r.minAmount.toFixed(2)),
            maxAmount: new Prisma.Decimal(r.maxAmount.toFixed(2)),
            commissionPercentage: new Prisma.Decimal(r.commissionPercentage.toFixed(2)),
            isActive: r.isActive,
            sortOrder: index,
          })),
        });
        await writeAdminAudit(tx, {
          adminId: auth.admin.id,
          action: input.action === "reset" ? "SERVICE_COMMISSION_RANGES_RESET" : "SERVICE_COMMISSION_RANGES_UPDATED",
          entityType: "ServiceCommissionRange",
          details: {
            before: serialize(before).map(({ minAmount, maxAmount, commissionPercentage, isActive }) => ({ minAmount, maxAmount, commissionPercentage, isActive })),
            after: ranges,
          } as unknown as Prisma.InputJsonValue,
        });
        return loadRows(tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json({ ok: true, ranges: serialize(rows), version: versionOf(rows), warnings: validation.warnings });
  } catch (error) {
    if (error && typeof error === "object" && "stale" in error) {
      return NextResponse.json(
        { error: "Another admin changed these ranges. Reload to see the latest before saving." },
        { status: 409 }
      );
    }
    console.error("[service-commission] save failed", error);
    return NextResponse.json({ error: "Could not save commission ranges." }, { status: 500 });
  }
}
