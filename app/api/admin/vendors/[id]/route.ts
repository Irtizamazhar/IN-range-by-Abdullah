export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { sendVendorApprovedEmail } from "@/lib/vendor-mail";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    rejectionReason: z.string().min(1).max(2000),
  }),
  z.object({ action: z.literal("suspend") }),
  z.object({
    action: z.literal("set_commission"),
    specialCommissionRate: z.union([
      z.number().min(0).max(100),
      z.null(),
    ]),
  }),
]);

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { id: true, email: true, shopName: true, status: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const wasAlreadyApproved = vendor.status === "approved";

  try {
    if (parsed.data.action === "approve") {
      await prisma.vendor.update({
        where: { id },
        data: {
          status: "approved",
          rejectionReason: null,
          isEmailVerified: true,
          emailVerifyToken: null,
        },
      });
      if (!wasAlreadyApproved) {
        try {
          await sendVendorApprovedEmail(vendor.email, vendor.shopName);
        } catch (mailErr) {
          console.error("vendor approval email", mailErr);
        }
      }
    } else if (parsed.data.action === "reject") {
      await prisma.vendor.update({
        where: { id },
        data: {
          status: "rejected",
          rejectionReason: sanitizePlainText(
            parsed.data.rejectionReason,
            2000
          ),
        },
      });
    } else if (parsed.data.action === "suspend") {
      await prisma.vendor.update({
        where: { id },
        data: { status: "suspended" },
      });
    } else {
      await prisma.vendor.update({
        where: { id },
        data: {
          specialCommissionRate:
            parsed.data.specialCommissionRate == null
              ? null
              : new Prisma.Decimal(
                  parsed.data.specialCommissionRate.toFixed(2)
                ),
        },
      });
    }

    await prisma.vendorAuditLog.create({
      data: {
        vendorId: id,
        action: `admin_${parsed.data.action}`,
        details: {
          adminEmail: session.user?.email ?? null,
          payload: JSON.parse(
            JSON.stringify(parsed.data)
          ) as Prisma.InputJsonValue,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin vendor PATCH", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
