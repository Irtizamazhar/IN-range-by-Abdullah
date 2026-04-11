export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const [rows, unread] = await Promise.all([
    prisma.vendorNotification.findMany({
      where: { vendorId: auth.vendor.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.vendorNotification.count({
      where: { vendorId: auth.vendor.id, isRead: false },
    }),
  ]);

  return NextResponse.json({
    unread,
    notifications: rows.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  let body: { markAllRead?: boolean };
  try {
    body = (await req.json()) as { markAllRead?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.markAllRead) {
    await prisma.vendorNotification.updateMany({
      where: { vendorId: auth.vendor.id, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
