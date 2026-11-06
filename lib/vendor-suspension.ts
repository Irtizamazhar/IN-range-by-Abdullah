import { Prisma, type VendorAccountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/marketplace-api";
import { sanitizePlainText } from "@/lib/security/sanitize";

export type SuspensionType = "temporary" | "permanent";

const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const RESTORABLE: readonly VendorAccountStatus[] = ["approved", "pending", "rejected", "onboarding"];
const CLEARED = { suspendedAt: null, suspensionReason: null, suspendedBy: null, suspensionUntil: null };

/** A suspension is temporary exactly when it has an end time. */
export function suspensionTypeOf(until: Date | null): SuspensionType {
  return until ? "temporary" : "permanent";
}

/** Reads a `datetime-local` value as Pakistan time, whatever timezone the server runs in. */
export function parseKarachiDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute));
  // Date.UTC rolls 31 Feb into March; reject anything that did not survive unchanged.
  if (wall.getUTCMonth() !== month - 1 || wall.getUTCDate() !== day || wall.getUTCHours() !== hour || wall.getUTCMinutes() !== minute) return null;
  return new Date(wall.getTime() - KARACHI_OFFSET_MS);
}

export function formatKarachi(date: Date): string {
  return `${date.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} PKT`;
}

function detailsOf(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** A deleted or environment-only admin must not fail the audit row's foreign key. */
async function knownAdminId(tx: Prisma.TransactionClient, adminId: string) {
  return (await tx.adminUser.findUnique({ where: { id: adminId }, select: { id: true } }))?.id ?? null;
}

export async function suspendVendor(input: { vendorId: string; adminId: string; adminEmail?: string | null; reason?: string; type?: SuspensionType; until?: string }) {
  const type = input.type ?? "permanent";
  const until = type === "temporary" ? parseKarachiDateTime(input.until ?? "") : null;
  if (type === "temporary" && !until) throw new ApiError(400, "Choose the date and time the temporary suspension should end.");
  if (until && until.getTime() <= Date.now()) throw new ApiError(400, "The suspension end time must be in the future.");
  const reason = sanitizePlainText(input.reason?.trim() || "Suspended by admin", 2000);

  return prisma.$transaction(async tx => {
    const vendor = await tx.vendor.findUnique({ where: { id: input.vendorId }, select: { status: true } });
    if (!vendor) throw new ApiError(404, "Vendor not found.");
    if (vendor.status === "suspended") throw new ApiError(409, "This vendor is already suspended.");
    // Conditional on the status just read, so two admins cannot both record a suspension.
    const updated = await tx.vendor.updateMany({
      where: { id: input.vendorId, status: vendor.status },
      data: { status: "suspended", suspendedAt: new Date(), suspensionReason: reason, suspendedBy: input.adminId, suspensionUntil: until, suspensionCount: { increment: 1 } },
    });
    if (updated.count !== 1) throw new ApiError(409, "This vendor just changed. Refresh and try again.");
    await tx.vendorSession.updateMany({ where: { vendorId: input.vendorId, isRevoked: false }, data: { isRevoked: true } });
    await tx.vendorAuditLog.create({
      data: {
        vendorId: input.vendorId,
        action: "admin_suspend",
        details: {
          adminEmail: input.adminEmail, adminId: input.adminId, previousStatus: vendor.status,
          payload: { action: "suspend", reason, suspensionType: type, suspensionUntil: until?.toISOString() ?? null },
        },
      },
    });
    await tx.adminAuditLog.create({
      data: { adminId: await knownAdminId(tx, input.adminId), action: "vendor_suspend", entityType: "Vendor", entityId: input.vendorId, details: { previousStatus: vendor.status, suspensionType: type, suspensionUntil: until?.toISOString() ?? null } },
    });
    return { type, until };
  });
}

/** Restores the status the vendor had when suspended; older suspensions recorded none and were approved sellers. */
async function restorableStatus(tx: Prisma.TransactionClient, vendorId: string): Promise<VendorAccountStatus> {
  const last = await tx.vendorAuditLog.findFirst({ where: { vendorId, action: "admin_suspend" }, orderBy: { createdAt: "desc" }, select: { details: true } });
  const previous = detailsOf(last?.details).previousStatus;
  return RESTORABLE.includes(previous as VendorAccountStatus) ? previous as VendorAccountStatus : "approved";
}

/** Admin reactivation. History stays in the audit log and `suspensionCount`. */
export async function unsuspendVendor(input: { vendorId: string; adminId: string; adminEmail?: string | null }) {
  return prisma.$transaction(async tx => {
    const status = await restorableStatus(tx, input.vendorId);
    const updated = await tx.vendor.updateMany({ where: { id: input.vendorId, status: "suspended" }, data: { status, ...CLEARED } });
    if (updated.count !== 1) throw new ApiError(409, "This vendor is not suspended.");
    await tx.vendorAuditLog.create({ data: { vendorId: input.vendorId, action: "admin_unsuspend", details: { adminEmail: input.adminEmail, adminId: input.adminId, restoredStatus: status } } });
    await tx.adminAuditLog.create({ data: { adminId: await knownAdminId(tx, input.adminId), action: "vendor_unsuspend", entityType: "Vendor", entityId: input.vendorId, details: { restoredStatus: status } } });
    return { status };
  });
}

/** Ends one temporary suspension if its time has passed. Permanent suspensions have no end time, so never match. */
export async function reactivateIfExpired(vendorId: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    const status = await restorableStatus(tx, vendorId);
    const updated = await tx.vendor.updateMany({ where: { id: vendorId, status: "suspended", suspensionUntil: { lte: now } }, data: { status, ...CLEARED } });
    if (updated.count !== 1) return false;
    await tx.vendorAuditLog.create({ data: { vendorId, action: "suspension_expired", details: { restoredStatus: status, expiredAt: now.toISOString() } } });
    return true;
  });
}

export async function reactivateExpiredSuspensions(now = new Date()) {
  const due = await prisma.vendor.findMany({ where: { status: "suspended", suspensionUntil: { lte: now } }, select: { id: true }, take: 200 });
  let reactivated = 0;
  for (const { id } of due) if (await reactivateIfExpired(id, now)) reactivated += 1;
  return reactivated;
}

let nextSweepAt = 0;

/**
 * Hosting has no scheduler for this, so normal traffic drives expiry: at most one check a minute,
 * from public store pages, admin vendor pages and vendor login. It never fails the page calling it.
 */
export async function sweepExpiredSuspensions() {
  if (Date.now() < nextSweepAt) return;
  nextSweepAt = Date.now() + SWEEP_INTERVAL_MS;
  try { await reactivateExpiredSuspensions(); }
  catch (error) { console.error("Vendor suspension sweep failed", error instanceof Error ? error.name : "Unknown error"); }
}
