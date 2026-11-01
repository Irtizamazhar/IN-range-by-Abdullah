import { isServiceImageUrl } from "@/lib/service-image-policy";
import { assertServiceImageStored } from "@/lib/service-images";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";
import { validateCoverage } from "@/lib/service-locations";
export const moneyInput = z.number().finite().positive().max(9999999).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < .000001, "Use at most two decimal places.");
export const priceTypeInput = z.enum(["FIXED", "STARTING_FROM"]);
const imageInput = z.string().max(2048).refine(isServiceImageUrl, "Choose a valid service image.").nullable().optional();
export const catalogInput = z.object({ id: z.string().optional(), imageUrl: imageInput, name: z.string().trim().min(1).max(160), category: z.string().trim().min(1).max(100), description: z.string().trim().min(1).max(5000), defaultPrice: moneyInput, priceType: priceTypeInput, active: z.boolean() });
export const listingInput = z.object({ id: z.string().optional(), catalogId: z.string().min(1).nullable(), imageUrl: imageInput, description: z.string().trim().min(1).max(5000), price: moneyInput, priceType: priceTypeInput, coverage: z.unknown(), durationMinutes: z.number().int().min(1).max(10080), leadDays: z.number().int().min(0).max(365), warranty: z.string().trim().max(1000), cancellationTerms: z.string().trim().min(1).max(5000), active: z.boolean(), version: z.string().optional() });
export async function listingData(tx: Prisma.TransactionClient, body: unknown, vendorId: string, admin = false) {
  const input = listingInput.parse(body);
  const existing = input.id ? await tx.serviceOffering.findFirst({ where: { id: input.id, vendorId } }) : null;
  if (input.id && !existing) throw new ApiError(404, "Service not found.");
  if (existing && input.version !== existing.updatedAt.toISOString()) throw new ApiError(409, "This listing changed. Reload before saving.");
  if (!admin && existing?.moderationStatus === "HIDDEN") throw new ApiError(403, "Contact support about an administrator-hidden listing.");
  const catalog = input.catalogId ? await tx.serviceCatalog.findFirst({ where: { id: input.catalogId, active: true } }) : null;
  if (input.catalogId && !catalog) throw new ApiError(400, "Choose an active catalog service.");
  if (!catalog && (!existing || existing.catalogId)) throw new ApiError(400, "Choose a catalog service.");
  if (catalog && await tx.serviceOffering.findFirst({ where: { vendorId, catalogId: catalog.id, ...(existing ? { id: { not: existing.id } } : {}) }, select: { id: true } })) throw new ApiError(409, "This provider already has a listing for this catalog service. Edit that listing instead.");
  if (input.imageUrl !== undefined && input.imageUrl !== existing?.imageUrl) await assertServiceImageStored(input.imageUrl, `vendor-${vendorId}`);
  const coverage = validateCoverage(input.coverage);
  const { id, version, ...fields } = input; void id; void version;
  return { existing, data: { ...fields, name: catalog?.name || existing!.name, type: catalog?.category || existing!.type, coverage, cities: coverage.map(row => row.city.name), moderationReason: null, submittedAt: new Date(), reviewedAt: null, reviewedBy: null } };
}
