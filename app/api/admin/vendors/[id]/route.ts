export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { sendVendorApprovedEmail, sendVendorRejectedEmail } from "@/lib/vendor-mail";
import { generateUniqueStoreSlug } from "@/lib/store-slug";
import { ApiError } from "@/lib/marketplace-api";
import { suspendVendor, unsuspendVendor } from "@/lib/vendor-suspension";

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
      { error: "Please check the suspension details and try again.", details: parsed.error.flatten() },
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

  // Review and commission need a submitted seller; suspending stays available for any account.
  if (vendor.status === "onboarding" && parsed.data.action !== "suspend") return NextResponse.json({ error: "Seller setup must be completed and submitted before review." }, { status: 409 });
  if (vendor.status === "suspended" && parsed.data.action === "reject") return NextResponse.json({ error: "Unsuspend this vendor before rejecting them." }, { status: 409 });
  const wasAlreadyApproved = vendor.status === "approved";
  const adminActorId = auth.admin.id;

  try {
    if (parsed.data.action === "suspend") {
      const result = await suspendVendor({
        vendorId: id,
        adminId: adminActorId,
        adminEmail: auth.admin.email,
        reason: parsed.data.reason,
        type: parsed.data.suspensionType,
        until: parsed.data.suspensionUntil,
      });
      return NextResponse.json({ ok: true, suspensionType: result.type, suspensionUntil: result.until?.toISOString() ?? null });
    }
    if (parsed.data.action === "unsuspend") {
      const result = await unsuspendVendor({ vendorId: id, adminId: adminActorId, adminEmail: auth.admin.email });
      return NextResponse.json({ ok: true, status: result.status });
    }

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
          ...(vendor.status === "suspended" ? { suspendedAt: null, suspensionReason: null, suspendedBy: null, suspensionUntil: null } : {}),
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
      if (vendor.status !== "rejected") {
        try { await sendVendorRejectedEmail(vendor.email, parsed.data.rejectionReason); }
        catch (mailError) { console.error("vendor rejection email", mailError instanceof Error ? mailError.name : "Unknown error"); }
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
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("admin vendor PATCH", e);
    return NextResponse.json({ error: "The update could not be saved. Nothing was changed." }, { status: 500 });
  }
}
