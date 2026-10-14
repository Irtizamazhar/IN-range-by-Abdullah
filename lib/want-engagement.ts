import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/sessions";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import {
  ACTIVE_OFFER_STATUSES,
  emptyReactionSummary,
  summarizeReactions,
  type ReactionSummary,
  type WantReactionKind,
} from "@/lib/want-social";

type Db = Prisma.TransactionClient | typeof prisma;

/** The only Wants anyone other than the owner may see: approved, unexpired, from an active customer. */
export function publicWantWhere(now = new Date()): Prisma.WantWhereInput {
  return { status: "OPEN", expiresAt: { gt: now }, customer: { isActive: true } };
}

/** Reactions, joins and offers only count while the account behind them is still active. */
const countedReactionWhere: Prisma.WantReactionWhereInput = {
  OR: [{ customer: { isActive: true } }, { vendor: { status: "approved" } }],
};

export type WantViewer = { customerId: string | null; vendorId: string | null };
export type WantActor = { customerId: string; vendorId?: undefined } | { vendorId: string; customerId?: undefined };

async function activeCustomerId() {
  const session = await getCustomerSession().catch(() => null);
  const id = session?.user?.role === "customer" ? session.user.id : null;
  if (!id) return null;
  const row = await prisma.customer.findUnique({ where: { id, isActive: true }, select: { id: true } });
  return row?.id ?? null;
}

/** Who is looking: an active customer, an approved (not suspended) vendor, both, or neither. */
export async function resolveWantViewer(): Promise<WantViewer> {
  const [customerId, vendor] = await Promise.all([
    activeCustomerId(),
    getVendorFromSession().catch(() => null),
  ]);
  return { customerId, vendorId: vendor?.vendor.id ?? null };
}

/** Reactions and reports are stored under the customer account when signed in as one, otherwise the vendor. */
export function actingIdentity(viewer: WantViewer): WantActor | null {
  if (viewer.customerId) return { customerId: viewer.customerId };
  if (viewer.vendorId) return { vendorId: viewer.vendorId };
  return null;
}

export function actorWhere(actor: WantActor): Prisma.WantReactionWhereInput {
  return actor.customerId ? { customerId: actor.customerId } : { vendorId: actor.vendorId };
}

export async function reactionSummaries(wantIds: string[], db: Db = prisma): Promise<Map<string, ReactionSummary>> {
  const result = new Map<string, ReactionSummary>(wantIds.map((id) => [id, emptyReactionSummary()]));
  if (!wantIds.length) return result;
  const rows = await db.wantReaction.groupBy({
    by: ["wantId", "type"],
    where: { wantId: { in: wantIds }, ...countedReactionWhere },
    _count: { _all: true },
  });
  const grouped = new Map<string, Array<{ type: string; count: number }>>();
  for (const row of rows) {
    const list = grouped.get(row.wantId) ?? [];
    list.push({ type: row.type, count: row._count._all });
    grouped.set(row.wantId, list);
  }
  grouped.forEach((list, wantId) => result.set(wantId, summarizeReactions(list)));
  return result;
}

/** Joined customers per Want (active accounts only; owners cannot join their own Want). */
export async function joinedCounts(wantIds: string[], db: Db = prisma) {
  const result = new Map<string, number>(wantIds.map((id) => [id, 0]));
  if (!wantIds.length) return result;
  const rows = await db.wantInterest.groupBy({
    by: ["wantId"],
    where: { wantId: { in: wantIds }, customer: { isActive: true } },
    _count: { _all: true },
  });
  for (const row of rows) result.set(row.wantId, row._count._all);
  return result;
}

/**
 * Vendors with a live offer per Want. WantOffer is unique per (want, vendor) and revisions live in
 * OfferRevision, so revisions never inflate this number.
 */
export async function activeOfferVendorCounts(wantIds: string[], db: Db = prisma) {
  const result = new Map<string, number>(wantIds.map((id) => [id, 0]));
  if (!wantIds.length) return result;
  const rows = await db.wantOffer.groupBy({
    by: ["wantId"],
    where: { wantId: { in: wantIds }, status: { in: [...ACTIVE_OFFER_STATUSES] }, vendor: { status: "approved" } },
    _count: { _all: true },
  });
  for (const row of rows) result.set(row.wantId, row._count._all);
  return result;
}

/** Join activity used by Trending: all-time, the last 7 days, and the 7 days before that. */
export async function interestActivity(wantIds: string[], now = new Date()) {
  const result = new Map<string, { total: number; recent: number; previous: number }>(wantIds.map((id) => [id, { total: 0, recent: 0, previous: 0 }]));
  if (!wantIds.length) return result;
  const recentStart = new Date(now.getTime() - 7 * 86400000);
  const previousStart = new Date(now.getTime() - 14 * 86400000);
  const base = { wantId: { in: wantIds }, customer: { isActive: true } };
  const [total, recent, previous] = await Promise.all([
    prisma.wantInterest.groupBy({ by: ["wantId"], where: base, _count: { _all: true } }),
    prisma.wantInterest.groupBy({ by: ["wantId"], where: { ...base, createdAt: { gte: recentStart } }, _count: { _all: true } }),
    prisma.wantInterest.groupBy({ by: ["wantId"], where: { ...base, createdAt: { gte: previousStart, lt: recentStart } }, _count: { _all: true } }),
  ]);
  for (const row of total) result.get(row.wantId)!.total = row._count._all;
  for (const row of recent) result.get(row.wantId)!.recent = row._count._all;
  for (const row of previous) result.get(row.wantId)!.previous = row._count._all;
  return result;
}

export type VendorOfferState ={ id: string; status: string; version: number; latestExpiresAt: string | null };
export type WantViewerState = {
  /** Which identity reactions are stored under; null for guests. */
  actor: "customer" | "vendor" | null;
  reaction: WantReactionKind | null;
  joined: boolean;
  isOwner: boolean;
  /** The signed-in vendor's own offer on this Want; never another vendor's. */
  vendorOffer: VendorOfferState | null;
  canJoin: boolean;
  canOffer: boolean;
};

export type WantEngagement = {
  reactions: ReactionSummary;
  joinedCount: number;
  offerVendorCount: number;
  viewer: WantViewerState;
};

type EngagementWant = { id: string; customerId: string; status: string; expiresAt: Date };

export async function wantEngagement(wants: EngagementWant[], viewer: WantViewer, now = new Date()): Promise<Map<string, WantEngagement>> {
  const ids = wants.map((want) => want.id);
  const actor = actingIdentity(viewer);
  const [reactions, joined, offers, myReactions, myInterests, vendorOffers] = await Promise.all([
    reactionSummaries(ids),
    joinedCounts(ids),
    activeOfferVendorCounts(ids),
    actor && ids.length
      ? prisma.wantReaction.findMany({ where: { wantId: { in: ids }, ...actorWhere(actor) }, select: { wantId: true, type: true } })
      : Promise.resolve([]),
    viewer.customerId && ids.length
      ? prisma.wantInterest.findMany({ where: { wantId: { in: ids }, customerId: viewer.customerId }, select: { wantId: true } })
      : Promise.resolve([]),
    viewer.vendorId && ids.length
      ? prisma.wantOffer.findMany({
          where: { wantId: { in: ids }, vendorId: viewer.vendorId },
          select: { id: true, wantId: true, status: true, version: true, revisions: { orderBy: { revisionNumber: "desc" }, take: 1, select: { expiresAt: true } } },
        })
      : Promise.resolve([]),
  ]);
  const reactionByWant = new Map(myReactions.map((row) => [row.wantId, row.type as WantReactionKind]));
  const joinedSet = new Set(myInterests.map((row) => row.wantId));
  const offerByWant = new Map(vendorOffers.map((row) => [row.wantId, row]));

  const result = new Map<string, WantEngagement>();
  for (const want of wants) {
    const open = want.status === "OPEN" && want.expiresAt > now;
    const isOwner = viewer.customerId === want.customerId;
    const offer = offerByWant.get(want.id);
    result.set(want.id, {
      reactions: reactions.get(want.id) ?? emptyReactionSummary(),
      joinedCount: joined.get(want.id) ?? 0,
      offerVendorCount: offers.get(want.id) ?? 0,
      viewer: {
        actor: actor ? (actor.customerId ? "customer" : "vendor") : null,
        reaction: reactionByWant.get(want.id) ?? null,
        joined: joinedSet.has(want.id),
        isOwner,
        vendorOffer: offer
          ? { id: offer.id, status: offer.status, version: offer.version, latestExpiresAt: offer.revisions[0]?.expiresAt.toISOString() ?? null }
          : null,
        canJoin: open && !!viewer.customerId && !isOwner,
        canOffer: open && !!viewer.vendorId && !offer,
      },
    });
  }
  return result;
}
