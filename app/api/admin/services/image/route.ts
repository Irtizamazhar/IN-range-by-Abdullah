import { requireAdminPermission } from "@/lib/admin-rbac";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { prisma } from "@/lib/prisma";
import { uploadServiceImage } from "@/lib/service-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  return api(async () => {
    sameOrigin(request);
    const query = new URL(request.url).searchParams;
    if (query.get("kind") === "listing") {
      const vendorId = query.get("vendorId") || "";
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(vendorId) || !await prisma.vendor.findFirst({ where: { id: vendorId, status: "approved" }, select: { id: true } })) {
        throw new ApiError(400, "Choose an approved provider before uploading.");
      }
      return uploadServiceImage(request, `vendor-${vendorId}`);
    }
    if (query.get("kind") && query.get("kind") !== "catalog") throw new ApiError(400, "Invalid service image type.");
    return uploadServiceImage(request, "catalog");
  });
}
