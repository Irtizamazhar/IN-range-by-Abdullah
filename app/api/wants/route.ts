import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { wantTrendService } from "@/lib/want-trend-service";
import { wantInput } from "@/lib/want-schema";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { assertWantPhotoStored, wantPhotoList } from "@/lib/want-photo-file";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return api(async () => {
  const q = new URL(request.url).searchParams;
  if (q.get("mine") === "1") { const customer = await customerActor(); return { wants: await prisma.want.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { interests: true } } } }) }; }
  return { wants: await wantTrendService({ city: q.get("city") || undefined, category: q.get("category") || undefined, newest: q.get("sort") === "newest" }) };
}); }
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); const customer = await customerActor(); const input = wantInput.parse(await request.json());
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + 30 * 86400000);
  if (expiresAt.getTime() <= Date.now() || expiresAt.getTime() > Date.now() + 90 * 86400000) throw new ApiError(400, "Expiry must be within the next 90 days.");
  const photos = wantPhotoList(input);
  for (const photo of photos) await assertWantPhotoStored(photo);
  const { draft, title, description, category, city, condition, photo: _photo, photos: _photos, ...data } = input; void _photo; void _photos;
  const want = await prisma.want.create({ data: { ...data, photo: photos[0] ?? null, photos, title: sanitizePlainText(title, 160), description: description ? sanitizePlainText(description, 5000) : undefined, category: sanitizePlainText(category, 100), city: sanitizePlainText(city, 100), condition: condition ? sanitizePlainText(condition, 60) : undefined, expiresAt, needBy: input.needBy ? new Date(input.needBy) : null, customerId: customer.id, status: draft ? "DRAFT" : "PENDING_MODERATION" }, select: { id: true, status: true } });
  return { want };
}); }
