export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string; appealId: string } };

export async function PATCH(_req: Request, ctx: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        resolvedBy: session.user?.email ?? null,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
