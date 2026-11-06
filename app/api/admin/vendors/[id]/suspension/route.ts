export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { reactivateIfExpired, suspensionTypeOf } from "@/lib/vendor-suspension";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireAdminPermission("vendors.manage");
  if ("response" in auth) return auth.response;

  const id = String(ctx.params.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await reactivateIfExpired(id);
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: {
      id: true,
      ownerName: true,
      shopName: true,
      email: true,
      status: true,
      createdAt: true,
      suspendedAt: true,
      suspensionReason: true,
      suspendedBy: true,
      suspensionUntil: true,
      suspensionCount: true,
    },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const logs = await prisma.vendorAuditLog.findMany({
    where: { vendorId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      details: true,
      createdAt: true,
    },
  });

  const appeals = logs.filter((l) => l.action === "vendor_appeal");
  const suspendLogs = logs.filter((l) => l.action === "admin_suspend");
  const history = suspendLogs.map((log) => {
    const details = log.details && typeof log.details === "object" ? (log.details as Record<string, unknown>) : {};
    const payload = details.payload && typeof details.payload === "object" ? (details.payload as Record<string, unknown>) : details;
    const until = typeof payload.suspensionUntil === "string" ? payload.suspensionUntil : null;
    return {
      id: log.id,
      at: log.createdAt.toISOString(),
      reason: typeof payload.reason === "string" ? payload.reason : null,
      suspensionType: payload.suspensionType === "temporary" || until ? "temporary" : "permanent",
      suspensionUntil: until,
      suspendedBy: typeof details.adminEmail === "string" ? details.adminEmail : null,
    };
  });
  const latest = history[0];
  const suspended = vendor.status === "suspended";

  return NextResponse.json({
    vendor: {
      ...vendor,
      // Older suspensions may exist in only one of these, so show whichever recorded more.
      suspensionCount: Math.max(vendor.suspensionCount, suspendLogs.length),
      createdAt: vendor.createdAt.toISOString(),
      suspendedAt: (suspended && vendor.suspendedAt?.toISOString()) || latest?.at || null,
      suspensionReason: (suspended && vendor.suspensionReason) || latest?.reason || null,
      suspendedBy: latest?.suspendedBy ?? null,
      suspensionType: suspended ? suspensionTypeOf(vendor.suspensionUntil) : latest?.suspensionType ?? null,
      suspensionUntil: suspended ? vendor.suspensionUntil?.toISOString() ?? null : latest?.suspensionUntil ?? null,
    },
    history,
    logs: logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    appeals: appeals.map((l) => ({
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      details: l.details,
    })),
  });
}
