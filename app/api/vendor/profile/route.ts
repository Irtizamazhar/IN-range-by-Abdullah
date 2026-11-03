import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { readCategories } from "@/lib/categories-store";
import { publicLocationRequest, readLocationRequest } from "@/lib/vendor-location-request";

export const dynamic = "force-dynamic";

// Same rule as Store & QR: an https URL or a path from the existing /uploads storage; blank removes the image.
const image = z.string().max(2048).refine(v => !v || /^https:\/\//.test(v) || v.startsWith("/uploads/") && !v.includes(".."), "Upload the image again.");

/** Only these fields can change here. City, address, slug and status are deliberately absent (strict rejects them). */
const input = z.object({
  shopName: z.string().trim().min(1, "Store name is required.").max(160),
  shopDescription: z.string().trim().max(5000),
  primaryCategory: z.string().trim().min(1, "Choose a category.").max(100),
  shopLogo: image,
  storeBanner: image,
}).strict();

const PROFILE_SELECT = { id: true, status: true, shopName: true, storeSlug: true, shopDescription: true, primaryCategory: true, shopLogo: true, storeBanner: true, city: true, address: true, _count: { select: { products: true } } } as const;

type ProfileRow = { _count: { products: number } } & Record<string, unknown>;
/** Flattens the product count used by the Store Strength card. */
function toProfile({ _count, ...profile }: ProfileRow) {
  return { ...profile, productCount: _count.products };
}

async function approvedVendor() {
  const session = await getVendorFromSession();
  if (!session) throw new ApiError(401, "Vendor sign-in required.");
  return session.vendor;
}

export async function GET() {
  return api(async () => {
    const vendor = await approvedVendor();
    const row = await prisma.vendor.findUnique({ where: { id: vendor.id }, select: { ...PROFILE_SELECT, onboardingData: true } });
    if (!row) throw new ApiError(404, "Store profile not found.");
    // Only the location request is exposed from the private onboarding data.
    const { onboardingData, ...profile } = row;
    return { profile: toProfile(profile), locationRequest: publicLocationRequest(readLocationRequest(onboardingData)) };
  });
}

export async function PATCH(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const vendor = await approvedVendor();
    if (vendor.status !== "approved") throw new ApiError(403, "Approved vendor required.");
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.message]));
      throw new ApiError(400, parsed.error.issues[0]?.message || "Please check the highlighted fields.", fieldErrors);
    }
    const data = parsed.data;
    const current = await prisma.vendor.findUnique({ where: { id: vendor.id }, select: { primaryCategory: true } });
    // Admin-managed categories only; a vendor may keep the category they already have.
    const categories = (await readCategories()).map(category => category.name);
    if (data.primaryCategory !== current?.primaryCategory && !categories.includes(data.primaryCategory)) {
      throw new ApiError(400, "Choose a category from the list.", { primaryCategory: "Choose a category from the list." });
    }
    await prisma.$transaction([
      prisma.vendor.update({ where: { id: vendor.id }, data, select: { id: true } }),
      prisma.marketplaceAudit.create({ data: { actor: `vendor:${vendor.id}`, action: "STORE_PROFILE_UPDATED", target: vendor.id, reason: "Vendor edited store profile." } }),
    ]);
    const profile = await prisma.vendor.findUnique({ where: { id: vendor.id }, select: PROFILE_SELECT });
    return { success: true, profile: profile && toProfile(profile) };
  });
}
