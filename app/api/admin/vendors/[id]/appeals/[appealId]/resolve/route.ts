export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string; appealId: string } };

export async function PATCH(_req: Request, ctx: Ctx) {
  const auth = await requireAdminPermission("vendors.manage");
  if ("response" in auth) return auth.response;

  const vendorId = String(ctx.params.id || "");
  const appealId = String(ctx.params.appealId || "");
  if (!vendorId || !appealId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const appeal = await prisma.vendorAuditLog.findFirst({
    where: { id: appealId, vendorId, action: "vendor_appeal" },
  });
  if (!appeal) {
    return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
  }

  const details =
    appeal.details && typeof appeal.details === "object"
      ? (appeal.details as Record<string, unknown>)
      : {};

  await prisma.vendorAuditLog.update({
    where: { id: appealId },
    data: {
      details: {
        ...details,
        resolved: true,
        resolvedAt: new Date().toISOString(),
        resolvedBy: auth.admin.email,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
