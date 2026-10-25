export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";

export type AdminNotificationKind = "appeal" | "want" | "gift" | "service" | "order" | "payout";

export type AdminNotification = {
  id: string;
  kind: AdminNotificationKind;
  createdAt: string;
  title: string;
  body: string;
  href: string;
  /** Still waiting on an admin (pending moderation, unread order, open payout, unresolved appeal). */
  needsAction: boolean;
  /** Not yet cleared by this admin's "Mark all read". */
  unread: boolean;
  status: string;
  attachmentUrl?: string | null;
};

const PER_SOURCE = 50;
const MAX_ITEMS = 150;

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}` : "";
}

/** "Mark all read" is stored as an admin audit row; its timestamp is the read watermark. */
const MARK_READ_ACTION = "admin_notifications_mark_all_read";

async function readWatermark(adminId: string) {
  const row = await prisma.adminAuditLog.findFirst({
    where: { action: MARK_READ_ACTION, entityType: "AdminUser", entityId: adminId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

export async function PATCH() {
  const auth = await requireAdminPermission("dashboard.view");
  if ("response" in auth) return auth.response;

  try {
    await writeAdminAudit(prisma, {
      adminId: auth.admin.id,
      action: MARK_READ_ACTION,
      entityType: "AdminUser",
      entityId: auth.admin.id,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PATCH /api/admin/notifications", e);
    return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 });
  }
}

function appealReasonLabel(reasonType: string) {
  if (reasonType === "payment_pending") return "Pending payment/dues";
  if (reasonType === "policy_misunderstanding") return "Policy misunderstanding";
  return "General review";
}

export async function GET() {
  const auth = await requireAdminPermission("dashboard.view");
  if ("response" in auth) return auth.response;
  const canSeeAppeals = hasAdminPermission([...auth.admin.permissions], "moderation.manage");

  try {
    const [seenAt, appeals, wants, orders, payouts, services] = await Promise.all([
      readWatermark(auth.admin.id),
      canSeeAppeals
        ? prisma.vendorAuditLog.findMany({
            where: { action: "vendor_appeal", vendor: { status: "suspended" } },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              createdAt: true,
              details: true,
              vendor: { select: { id: true, shopName: true, ownerName: true, email: true } },
            },
          })
        : Promise.resolve([]),
      prisma.want.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: {
          id: true,
          title: true,
          requestType: true,
          occasion: true,
          city: true,
          status: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          city: true,
          totalAmount: true,
          paymentMethod: true,
          orderStatus: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.vendorWithdrawal.findMany({
        orderBy: { requestedAt: "desc" },
        take: PER_SOURCE,
        select: {
          id: true,
          requestedAmount: true,
          status: true,
          requestedAt: true,
          vendor: { select: { shopName: true } },
        },
      }),
      prisma.serviceOffering.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: {
          id: true,
          name: true,
          type: true,
          price: true,
          moderationStatus: true,
          createdAt: true,
          vendor: { select: { shopName: true } },
        },
      }),
    ]);

    const items: Omit<AdminNotification, "unread">[] = [];

    // One latest unresolved appeal per vendor, as before.
    const appealVendors = new Set<string>();
    for (const r of appeals) {
      const d = r.details && typeof r.details === "object" ? (r.details as Record<string, unknown>) : {};
      if (d.resolved === true || !r.vendor || appealVendors.has(r.vendor.id)) continue;
      appealVendors.add(r.vendor.id);
      const message = typeof d.message === "string" ? d.message.trim() : "";
      items.push({
        id: `appeal:${r.id}`,
        kind: "appeal",
        createdAt: r.createdAt.toISOString(),
        title: `Vendor appeal: ${r.vendor.shopName} (${r.vendor.ownerName})`,
        body: `${appealReasonLabel(typeof d.reasonType === "string" ? d.reasonType : "general")} · ${message || "No message provided."}`,
        href: `/admin/vendors/${encodeURIComponent(r.vendor.id)}/suspension`,
        needsAction: true,
        status: "Pending",
        attachmentUrl: typeof d.paymentProofUrl === "string" ? d.paymentProofUrl : null,
      });
    }

    for (const w of wants) {
      const kind: AdminNotificationKind =
        w.requestType === "GIFT" ? "gift" : w.requestType === "SERVICE" ? "service" : "want";
      const label = kind === "gift" ? "gift request" : kind === "service" ? "service request" : "want";
      items.push({
        id: `want:${w.id}`,
        kind,
        createdAt: w.createdAt.toISOString(),
        title: `New ${label}: ${w.title}`,
        body: [w.customer?.name, w.city, w.occasion].filter(Boolean).join(" · "),
        href: "/admin/wants",
        needsAction: w.status === "PENDING_MODERATION" || w.status === "SUBMITTED",
        status: w.status.replace(/_/g, " ").toLowerCase(),
      });
    }

    for (const o of orders) {
      items.push({
        id: `order:${o.id}`,
        kind: "order",
        createdAt: o.createdAt.toISOString(),
        title: `New order #${o.orderNumber}`,
        body: [o.customerName, o.city, money(o.totalAmount), o.paymentMethod].filter(Boolean).join(" · "),
        href: `/admin/orders/${encodeURIComponent(o.id)}`,
        needsAction: !o.isRead,
        status: o.orderStatus,
      });
    }

    for (const p of payouts) {
      items.push({
        id: `payout:${p.id}`,
        kind: "payout",
        createdAt: p.requestedAt.toISOString(),
        title: `Payout request: ${p.vendor?.shopName ?? "Vendor"}`,
        body: money(p.requestedAmount),
        href: "/admin/dashboard/payouts",
        needsAction: p.status === "pending",
        status: p.status,
      });
    }

    for (const s of services) {
      items.push({
        id: `service:${s.id}`,
        kind: "service",
        createdAt: s.createdAt.toISOString(),
        title: `New service listing: ${s.name}`,
        body: [s.vendor?.shopName, s.type, money(s.price)].filter(Boolean).join(" · "),
        href: "/admin/services",
        needsAction: s.moderationStatus !== "APPROVED" && s.moderationStatus !== "HIDDEN",
        status: s.moderationStatus.toLowerCase(),
      });
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // Before the first "Mark all read", only items needing action count as unread.
    const notifications: AdminNotification[] = items.slice(0, MAX_ITEMS).map((n) => ({
      ...n,
      unread: seenAt ? new Date(n.createdAt) > seenAt : n.needsAction,
    }));

    return NextResponse.json({
      notifications,
      unresolvedCount: notifications.filter((n) => n.unread).length,
      latestAt: notifications[0]?.createdAt ?? null,
    });
  } catch (e) {
    console.error("GET /api/admin/notifications", e);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}
