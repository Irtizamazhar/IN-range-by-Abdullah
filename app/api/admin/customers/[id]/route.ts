export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  isActive: z.boolean(),
  adminNote: z.string().trim().min(3).max(3000),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminPermission("customers.manage");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "A reason is required" }, { status: 400 });
  }
  const current = await prisma.customer.findUnique({ where: { id: params.id }, select: { id: true, email: true, isActive: true } });
  if (!current) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: current.id },
      data: {
        isActive: parsed.data.isActive,
        adminNote: parsed.data.adminNote,
        sessionVersion: { increment: 1 },
      },
      select: { id: true, isActive: true, adminNote: true },
    });
    await writeAdminAudit(tx, {
      adminId: auth.admin.id,
      action: parsed.data.isActive ? "customer_reactivated" : "customer_suspended",
      entityType: "Customer",
      entityId: current.id,
      details: { email: current.email, previousActive: current.isActive, note: parsed.data.adminNote },
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent"),
    });
    return updated;
  });
  return NextResponse.json({ customer: row });
}
