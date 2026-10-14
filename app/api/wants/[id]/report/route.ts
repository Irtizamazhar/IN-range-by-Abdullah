import { Prisma } from "@prisma/client";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { consumeOrReject } from "@/lib/security/rate-limit";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { actingIdentity, publicWantWhere, resolveWantViewer } from "@/lib/want-engagement";
import { WANT_REPORT_REASONS } from "@/lib/want-social";

export const dynamic = "force-dynamic";
type Context = { params: { id: string } };

/** 10 reports per hour per account. */
const limiter = new RateLimiterMemory({ points: 10, duration: 60 * 60 });
const reasons = WANT_REPORT_REASONS.map((reason) => reason.value) as [string, ...string[]];
const reportInput = z.object({ reason: z.enum(reasons), details: z.string().trim().max(1000).optional() });

/** Flags a public Want for admin review. Reporting the same Want twice is accepted without a duplicate. */
export async function POST(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request);
  const parsed = reportInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "Choose a reason for your report.");
  const actor = actingIdentity(await resolveWantViewer());
  if (!actor) throw new ApiError(401, "Please sign in to report a Want.");
  const limit = await consumeOrReject(limiter, `want-report:${actor.customerId ?? `v:${actor.vendorId}`}`);
  if (!limit.ok) throw new ApiError(429, "You have sent several reports recently. Please try again later.");
  const want = await prisma.want.findFirst({ where: { id: params.id, ...publicWantWhere() }, select: { id: true, customerId: true } });
  if (!want) throw new ApiError(404, "This Want is not available.");
  if (actor.customerId && actor.customerId === want.customerId) throw new ApiError(400, "You can't report your own Want. Edit or delete it instead.");
  try {
    await prisma.wantReport.create({ data: {
      wantId: want.id,
      reason: parsed.data.reason,
      details: parsed.data.details ? sanitizePlainText(parsed.data.details, 1000) : null,
      ...(actor.customerId ? { customerId: actor.customerId } : { vendorId: actor.vendorId }),
    } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
  return { ok: true };
}); }
