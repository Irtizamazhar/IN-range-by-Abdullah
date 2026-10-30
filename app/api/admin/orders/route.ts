export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { deleteOrders } from "@/lib/admin-order-delete";

/** Permanently deletes the selected orders. Orders with refunds or paid-out vendor earnings are kept and counted as skipped. */
export async function DELETE(request: Request) {
  const auth = await requireAdminPermission("orders.manage");
  if ("response" in auth) return auth.response;
  try {
    sameOrigin(request);
    const { ids } = z.object({ ids: z.array(z.string().min(1).max(191)).min(1).max(500) }).parse(await request.json());
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await deleteOrders(tx, Array.from(new Set(ids)));
      if (deleted.deleted.length) {
        await writeAdminAudit(tx, { adminId: auth.admin.id, action: "orders_deleted", entityType: "Order", details: { deleted: deleted.deleted, skipped: deleted.skipped } });
      }
      return deleted;
    }, { isolationLevel: "Serializable", timeout: 60_000 });
    return NextResponse.json({ deleted: result.deleted.length, skipped: result.skipped });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Please select at least one order." }, { status: 400 });
    console.error("Admin order delete failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Could not delete orders. Please try again later." }, { status: 503 });
  }
}
