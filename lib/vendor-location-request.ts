import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/marketplace-api";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { createSupportTicket, formatTicketNumber, ticketHref } from "@/lib/support-service";
import { notifyVendor } from "@/lib/marketplace-notifications";
import { writeAdminAudit } from "@/lib/admin-rbac";

/**
 * Approved sellers cannot edit their verified city/address directly. They file a request, which is kept in the
 * seller's private onboardingData (no schema change) and surfaced to admins as a linked support ticket.
 * Only an admin approval writes the new location to the Vendor record.
 */
export const LOCATION_REQUEST_RESOURCE = "LOCATION_CHANGE";
const KEY = "locationChangeRequest";

export type LocationRequest = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  city: string; address: string; reason: string;
  previousCity: string; previousAddress: string;
  ticketId: string; ticketNumber: string;
  requestedAt: string; reviewedAt?: string; reviewNote?: string;
};

const text = (min: number, max: number, message: string) => z.string().trim().max(max).transform(v => sanitizePlainText(v, max)).pipe(z.string().min(min, message));
export const locationRequestInput = z.object({
  city: text(2, 120, "Enter the new city."),
  address: text(5, 2000, "Enter the full new address."),
  reason: text(5, 1000, "Tell us briefly why the location is changing."),
}).strict();

function details(json: Prisma.JsonValue | null): Record<string, unknown> {
  return json && typeof json === "object" && !Array.isArray(json) ? { ...json } : {};
}

export function readLocationRequest(onboardingData: Prisma.JsonValue | null): LocationRequest | null {
  const value = details(onboardingData)[KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const request = value as Partial<LocationRequest>;
  return request.status && request.city && request.ticketId ? request as LocationRequest : null;
}

/** The seller's view: never includes admin-only data beyond the decision note. */
export function publicLocationRequest(request: LocationRequest | null) {
  if (!request) return null;
  const { status, city, address, ticketId, ticketNumber, requestedAt, reviewedAt, reviewNote } = request;
  return { status, city, address, ticketNumber, ticketHref: ticketHref("VENDOR", ticketId), requestedAt, reviewedAt: reviewedAt || null, reviewNote: reviewNote || null };
}

export async function createLocationRequest(vendorId: string, raw: unknown) {
  const input = locationRequestInput.parse(raw);
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { email: true, status: true, city: true, address: true, onboardingData: true } });
  if (!vendor || vendor.status !== "approved") throw new ApiError(403, "Approved vendor required.");
  if (readLocationRequest(vendor.onboardingData)?.status === "PENDING") throw new ApiError(409, "You already have a location change under review.");
  if (input.city.toLowerCase() === vendor.city.trim().toLowerCase() && input.address.toLowerCase() === vendor.address.trim().toLowerCase()) {
    throw new ApiError(400, "This is already your registered location.", { address: "Enter a different city or address." });
  }
  const ticket = await createSupportTicket({
    actorType: "VENDOR", actorId: vendorId, actorEmail: vendor.email, category: "ACCOUNT_VERIFICATION",
    subject: "Registered location change request",
    message: `Please update my registered location.\n\nCurrent: ${vendor.address}, ${vendor.city}\nRequested: ${input.address}, ${input.city}\n\nReason: ${input.reason}`,
  });
  const request: LocationRequest = {
    status: "PENDING", ...input, previousCity: vendor.city, previousAddress: vendor.address,
    ticketId: ticket.id, ticketNumber: formatTicketNumber(ticket.sequence), requestedAt: new Date().toISOString(),
  };
  await prisma.$transaction(async tx => {
    // Link the ticket to this request so the admin ticket view can show Approve / Reject.
    await tx.supportTicket.update({ where: { id: ticket.id }, data: { relatedResourceType: LOCATION_REQUEST_RESOURCE, relatedResourceId: vendorId } });
    // Re-read inside the transaction so a concurrent request cannot slip in.
    const fresh = await tx.vendor.findUnique({ where: { id: vendorId }, select: { onboardingData: true } });
    if (readLocationRequest(fresh?.onboardingData ?? null)?.status === "PENDING") throw new ApiError(409, "You already have a location change under review.");
    await tx.vendor.update({ where: { id: vendorId }, data: { onboardingData: { ...details(fresh?.onboardingData ?? null), [KEY]: request } as Prisma.InputJsonObject } });
  }, { isolationLevel: "Serializable" }).catch(async error => {
    // Do not leave an open ticket for a request that was never recorded.
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "CLOSED" } }).catch(() => {});
    throw error;
  });
  return request;
}

export const reviewInput = z.object({
  ticketId: z.string().min(1).max(191),
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).transform(v => sanitizePlainText(v, 1000)).optional().default(""),
}).strict().refine(v => v.action === "approve" || v.note.length >= 3, { path: ["note"], message: "Give the seller a short reason for rejecting." });

export async function reviewLocationRequest(adminId: string, vendorId: string, raw: unknown) {
  const { ticketId, action, note } = reviewInput.parse(raw);
  return prisma.$transaction(async tx => {
    const vendor = await tx.vendor.findUnique({ where: { id: vendorId }, select: { city: true, address: true, onboardingData: true } });
    const request = vendor && readLocationRequest(vendor.onboardingData);
    if (!vendor || !request || request.ticketId !== ticketId) throw new ApiError(404, "Location request not found.");
    if (request.status !== "PENDING") throw new ApiError(409, `This request was already ${request.status.toLowerCase()}.`);
    const reviewed: LocationRequest = { ...request, status: action === "approve" ? "APPROVED" : "REJECTED", reviewedAt: new Date().toISOString(), ...(note ? { reviewNote: note } : {}) };
    await tx.vendor.update({
      where: { id: vendorId },
      data: {
        ...(action === "approve" ? { city: request.city, address: request.address } : {}),
        onboardingData: { ...details(vendor.onboardingData), [KEY]: reviewed } as Prisma.InputJsonObject,
      },
    });
    const reply = action === "approve"
      ? `Your registered location has been updated to: ${request.address}, ${request.city}.${note ? `\n\n${note}` : ""}`
      : `Your location change request was not approved.\n\nReason: ${note}`;
    await tx.supportMessage.create({ data: { ticketId, senderType: "ADMIN", senderId: adminId, body: reply } });
    await tx.supportTicket.update({ where: { id: ticketId }, data: { status: "RESOLVED", lastActivityAt: new Date() } });
    await notifyVendor(tx, vendorId, `location-request:${ticketId}:${reviewed.status}`, action === "approve" ? "Your registered location was updated" : "Location change request not approved", "/vendor/dashboard/profile");
    await writeAdminAudit(tx, { adminId, action: action === "approve" ? "VENDOR_LOCATION_CHANGE_APPROVED" : "VENDOR_LOCATION_CHANGE_REJECTED", entityType: "Vendor", entityId: vendorId,
      details: { ticketId, from: { city: vendor.city, address: vendor.address }, to: { city: request.city, address: request.address }, note } });
    return reviewed;
  }, { isolationLevel: "Serializable" });
}
