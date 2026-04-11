export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, ctx: Ctx) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  const n = await prisma.vendorNotification.findFirst({
    where: { id, vendorId: auth.vendor.id },
  });
  if (!n) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.vendorNotification.update({
    where: { id },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
