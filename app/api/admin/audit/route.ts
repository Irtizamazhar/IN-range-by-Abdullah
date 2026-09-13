export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdminPermission("audit.view");
  if ("response" in auth) return auth.response;
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 250,
    include: { admin: { select: { name: true, email: true } } },
  });
  return NextResponse.json({
    audit: rows.map((row) => ({
      id: row.id,
      actor: row.admin?.name ?? "Environment admin",
      actorEmail: row.admin?.email ?? null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      details: row.details,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
