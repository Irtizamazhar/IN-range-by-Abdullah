export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { createCustomerNotification } from "@/lib/customer-notifications";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("reject"), note: z.string().min(3).max(1000) }),
]);

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, context: Ctx) {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const current = await prisma.wantPost.findUnique({ where: { id: context.params.id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const status = parsed.data.action === "approve" ? "open" : parsed.data.action === "reject" ? "rejected" : "closed";
  const note = parsed.data.action === "reject" ? sanitizePlainText(parsed.data.note, 1000) : null;

  await prisma.$transaction(async (tx) => {
    await tx.wantPost.update({
      where: { id: current.id },
      data: { status, moderationNote: note },
    });
    if (status === "rejected" || status === "closed") {
      await tx.wantOffer.updateMany({
        where: { wantId: current.id, status: "pending" },
        data: { status: "rejected" },
      });
    }
    await tx.vendorAuditLog.create({
      data: {
        action: "admin_want_moderation",
        details: {
          wantId: current.id,
          fromStatus: current.status,
          toStatus: status,
          note,
          actor: auth.admin.email,
        },
      },
    });
    await writeAdminAudit(tx, {
      adminId: auth.admin.id,
      action: "want_moderated",
      entityType: "WantPost",
      entityId: current.id,
      details: { fromStatus: current.status, toStatus: status, note },
    });
    await createCustomerNotification({
      customerId: current.customerId,
      type: "want_moderation",
      title: status === "open" ? "Your Want is now live" : `Your Want was ${status}`,
      message: note || `Status changed to ${status}.`,
      link: `/wants/${current.id}`,
      idempotencyKey: `want-moderation:${current.id}:${status}`,
    }, tx);
  });
  return NextResponse.json({ ok: true, status });
}
