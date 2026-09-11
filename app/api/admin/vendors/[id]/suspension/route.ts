export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = String(ctx.params.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: {
      id: true,
      ownerName: true,
      shopName: true,
      email: true,
      status: true,
      createdAt: true,
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
  const latestSuspend = suspendLogs[0];
  const latestSuspendDetails =
    latestSuspend?.details && typeof latestSuspend.details === "object"
      ? (latestSuspend.details as Record<string, unknown>)
      : {};
  const suspensionPayload =
    latestSuspendDetails.payload && typeof latestSuspendDetails.payload === "object"
      ? (latestSuspendDetails.payload as Record<string, unknown>)
      : latestSuspendDetails;

  return NextResponse.json({
    vendor: {
      ...vendor,
      suspensionCount: suspendLogs.length,
      createdAt: vendor.createdAt.toISOString(),
      suspendedAt: latestSuspend ? latestSuspend.createdAt.toISOString() : null,
      suspensionReason:
        typeof suspensionPayload.reason === "string"
          ? suspensionPayload.reason
          : null,
      suspendedBy:
        typeof latestSuspendDetails.adminEmail === "string"
          ? latestSuspendDetails.adminEmail
          : null,
      suspensionUntil:
        typeof suspensionPayload.suspensionUntil === "string"
          ? suspensionPayload.suspensionUntil
          : null,
    },
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
