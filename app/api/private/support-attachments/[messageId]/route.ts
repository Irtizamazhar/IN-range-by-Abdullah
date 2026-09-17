export const dynamic = "force-dynamic";

import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getCustomerSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { supportAttachmentStoragePath } from "@/lib/support-attachment";

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

  const filePath = supportAttachmentStoragePath(message.attachmentUrl);
  if (!filePath) return NextResponse.json({ error: "Invalid file record" }, { status: 500 });
  try {
    const data = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const mime = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
    return new NextResponse(data, {
      headers: { "Content-Type": mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
