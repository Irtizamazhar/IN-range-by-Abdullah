export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getCustomerSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { normalizePrivatePath, privateImageMime, readPrivateFile } from "@/lib/private-storage";

type Ctx = { params: { messageId: string } };

export async function GET(_request: Request, context: Ctx) {
  const message = await prisma.supportMessage.findUnique({
    where: { id: context.params.messageId },
    select: { id: true, attachmentUrl: true, isInternalNote: true, ticket: { select: { customerId: true, vendorId: true } } },
  });
  if (!message || !message.attachmentUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = await getAdminSession();
  if (admin?.user?.role === "admin") {
    const auth = await requireAdminPermission("support.manage");
    if ("response" in auth) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else if (message.isInternalNote) {
    // Internal notes (and their attachments) are admin-only, regardless of ticket ownership.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else {
    const customerSession = await getCustomerSession();
    const isOwnerCustomer = customerSession?.user?.role === "customer" && customerSession.user.id && customerSession.user.id === message.ticket.customerId;
    if (!isOwnerCustomer) {
      const vendorSession = await getVendorFromSession();
      const isOwnerVendor = vendorSession && vendorSession.vendor.id === message.ticket.vendorId;
      if (!isOwnerVendor) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const relative = normalizePrivatePath(message.attachmentUrl);
  if (!relative || !relative.startsWith("support/")) return NextResponse.json({ error: "Invalid file record" }, { status: 500 });
  const data = await readPrivateFile(relative);
  if (!data) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": privateImageMime(relative), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
