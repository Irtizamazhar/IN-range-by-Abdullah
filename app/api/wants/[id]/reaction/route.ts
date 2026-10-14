import { Prisma } from "@prisma/client";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { consumeOrReject } from "@/lib/security/rate-limit";
import { actingIdentity, actorWhere, publicWantWhere, reactionSummaries, resolveWantViewer, type WantActor } from "@/lib/want-engagement";
import { isWantReaction } from "@/lib/want-social";

export const dynamic = "force-dynamic";
type Context = { params: { id: string } };

/** 30 reaction changes per minute per account stops click-spam without hurting normal use. */
const limiter = new RateLimiterMemory({ points: 30, duration: 60 });

async function authorize(request: Request, wantId: string): Promise<WantActor> {
  sameOrigin(request);
  const actor = actingIdentity(await resolveWantViewer());
  if (!actor) throw new ApiError(401, "Please sign in to react.");
  const limit = await consumeOrReject(limiter, `want-reaction:${actor.customerId ?? `v:${actor.vendorId}`}`);
  if (!limit.ok) throw new ApiError(429, "You're reacting too quickly. Please wait a moment.");
  const want = await prisma.want.findFirst({ where: { id: wantId, ...publicWantWhere() }, select: { id: true } });
  if (!want) throw new ApiError(404, "This Want is not available.");
  return actor;
}

async function respond(wantId: string, actor: WantActor) {
  const [summaries, mine] = await Promise.all([
    reactionSummaries([wantId]),
    prisma.wantReaction.findFirst({ where: { wantId, ...actorWhere(actor) }, select: { type: true } }),
  ]);
  return { reaction: mine?.type ?? null, reactions: summaries.get(wantId) };
}

/** Sets (or switches) the caller's single reaction. Repeating the same request is a no-op. */
export async function PUT(request: Request, { params }: Context) { return api(async () => {
  const body = await request.json().catch(() => null) as { type?: unknown } | null;
  if (!isWantReaction(body?.type)) throw new ApiError(400, "Choose Like, Love, Support, Wow, or Fire.");
  const type = body.type;
  const actor = await authorize(request, params.id);
  const where = actor.customerId
    ? { wantId_customerId: { wantId: params.id, customerId: actor.customerId } }
    : { wantId_vendorId: { wantId: params.id, vendorId: actor.vendorId! } };
  const data = { wantId: params.id, type, ...(actor.customerId ? { customerId: actor.customerId } : { vendorId: actor.vendorId }) };
  try {
    await prisma.wantReaction.upsert({ where, create: data, update: { type } });
  } catch (error) {
    // Two simultaneous first reactions race on the unique key; the loser just updates.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    await prisma.wantReaction.update({ where, data: { type } });
  }
  return respond(params.id, actor);
}); }

/** Removes the caller's reaction (clicking the same reaction again). */
export async function DELETE(request: Request, { params }: Context) { return api(async () => {
  const actor = await authorize(request, params.id);
  await prisma.wantReaction.deleteMany({ where: { wantId: params.id, ...actorWhere(actor) } });
  return respond(params.id, actor);
}); }
