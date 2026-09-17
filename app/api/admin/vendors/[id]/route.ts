export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { sendVendorApprovedEmail } from "@/lib/vendor-mail";
import { generateUniqueStoreSlug } from "@/lib/store-slug";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    rejectionReason: z.string().min(1).max(2000),
  }),
  z.object({
    action: z.literal("suspend"),
    reason: z.string().min(1).max(2000).optional(),
    suspensionType: z.enum(["permanent", "temporary"]).optional(),
    suspensionUntil: z.string().optional(),
  }),
  z.object({ action: z.literal("unsuspend") }),
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
  const auth = await requireAdminPermission("vendors.manage");
  if ("response" in auth) return auth.response;

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
    select: { id: true, email: true, shopName: true, status: true, storeSlug: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  if (vendor.status === "onboarding") return NextResponse.json({ error: "Seller setup must be completed and submitted before review." }, { status: 409 });
  const wasAlreadyApproved = vendor.status === "approved";
  const adminActorId = auth.admin.id;

  try {
    if (parsed.data.action === "approve") {
      const storeSlug = vendor.storeSlug || (await generateUniqueStoreSlug(prisma, vendor.shopName, vendor.id));
      await prisma.vendor.update({
        where: { id },
        data: {
          status: "approved",
          rejectionReason: null,
          isEmailVerified: true,
          emailVerifyToken: null,
          ...(vendor.storeSlug ? {} : { storeSlug }),
        },
      });
      // Once vendor is approved again, clear pending appeal notifications.
      const unresolvedAppeals = await prisma.vendorAuditLog.findMany({
        where: { vendorId: id, action: "vendor_appeal" },
        select: { id: true, details: true },
      });
      await Promise.all(
        unresolvedAppeals.map(async (appeal) => {
          const details =
            appeal.details && typeof appeal.details === "object"
              ? (appeal.details as Record<string, unknown>)
              : {};
          if (details.resolved === true) return;
          await prisma.vendorAuditLog.update({
            where: { id: appeal.id },
            data: {
              details: {
                ...details,
                resolved: true,
                resolvedAt: new Date().toISOString(),
                resolvedBy: auth.admin.email,
                resolutionNote: "Auto-resolved after vendor approval",
              },
            },
          });
        })
      );
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
      const until =
        parsed.data.suspensionType === "temporary" &&
        parsed.data.suspensionUntil
          ? new Date(parsed.data.suspensionUntil)
          : null;
      if (parsed.data.suspensionType === "temporary" &&
          (!until || Number.isNaN(until.getTime()) || until.getTime() <= Date.now())) {
        return NextResponse.json(
          { error: "Temporary suspension requires a future end date" },
          { status: 400 }
        );
      }
      try {
        await prisma.vendor.update({
          where: { id },
          data: {
            status: "suspended",
            suspendedAt: new Date(),
            suspensionReason: sanitizePlainText(
              parsed.data.reason || "Suspended by admin",
              2000
            ),
            suspendedBy: adminActorId,
            suspensionUntil: until,
            suspensionCount: { increment: 1 },
          } as never,
        });
      } catch {
        // Backward compatibility until DB migration is applied.
        await prisma.vendor.update({
          where: { id },
          data: { status: "suspended" },
        });
      }
    } else if (parsed.data.action === "unsuspend") {
      try {
        await prisma.vendor.update({
          where: { id },
          data: {
            status: "approved",
            suspendedAt: null,
            suspensionReason: null,
            suspendedBy: null,
            suspensionUntil: null,
          } as never,
        });
      } catch {
        // Backward compatibility until DB migration is applied.
        await prisma.vendor.update({
          where: { id },
          data: { status: "approved" },
        });
      }
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
          adminEmail: auth.admin.email,
          adminId: adminActorId,
          payload: JSON.parse(
            JSON.stringify(parsed.data)
          ) as Prisma.InputJsonValue,
        },
      },
    });
    await writeAdminAudit(prisma, {
      adminId: auth.admin.id,
      action: `vendor_${parsed.data.action}`,
      entityType: "Vendor",
      entityId: id,
      details: { previousStatus: vendor.status },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin vendor PATCH", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
