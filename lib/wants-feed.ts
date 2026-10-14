import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { demandScore } from "./want-ranking";
import { emptyReactionSummary, publicDisplayName } from "./want-social";
import type { WantEngagement } from "./want-engagement";
import type { WantRequestType, WantsFeedItem, WantsFeedPage, WantsFeedTab, WantsFeedViewer } from "./wants-feed-types";

export const WANTS_FEED_DEFAULT_LIMIT = 10;
export const WANTS_FEED_MAX_LIMIT = 20;
/** Trending ranks the newest open Wants by demand; this caps how many are scored per request. */
export const TRENDING_CANDIDATE_LIMIT = 300;

export class WantsFeedInputError extends Error {}

export type WantsFeedQuery = {
  tab: WantsFeedTab;
  city: string;
  category: string;
  type: WantRequestType | "";
  search: string;
  limit: number;
  cursor: string | null;
};

type FeedCursor = { version: 1; createdAt: string; id: string; scope: string };
type TrendingCursor = { version: 1; offset: number; scope: string };

const TABS: readonly WantsFeedTab[] = ["all", "trending", "mine", "joined", "nearby"];
const TYPES: readonly WantRequestType[] = ["PRODUCT", "SERVICE", "GIFT"];

export function parseWantsFeedQuery(params: URLSearchParams): WantsFeedQuery {
  const tab = (params.get("tab") || "all") as WantsFeedTab;
  if (!TABS.includes(tab)) {
    throw new WantsFeedInputError("Choose Latest, Trending, My Wants, or Joined.");
  }
  const city = (params.get("city") || "").trim();
  const category = (params.get("category") || "").trim();
  const search = (params.get("q") || "").trim();
  if (city.length > 100 || category.length > 100 || search.length > 100) {
    throw new WantsFeedInputError("City, category and search must be 100 characters or fewer.");
  }
  const rawType = (params.get("type") || "").trim().toUpperCase();
  if (rawType && !TYPES.includes(rawType as WantRequestType)) {
    throw new WantsFeedInputError("Choose Product, Service, or Gift.");
  }
  if (tab === "nearby" && !city) {
    throw new WantsFeedInputError("Choose a city to see nearby Wants.");
  }
  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? WANTS_FEED_DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > WANTS_FEED_MAX_LIMIT) {
    throw new WantsFeedInputError(`Page size must be between 1 and ${WANTS_FEED_MAX_LIMIT}.`);
  }
  const cursor = params.get("cursor") || null;
  if (cursor && (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor))) {
    throw new WantsFeedInputError("This feed cursor is invalid. Refresh the feed and try again.");
  }
  return { tab, city, category, type: rawType as WantRequestType | "", search, limit, cursor };
}

const accountTab = (tab: WantsFeedTab) => tab === "mine" || tab === "joined";

function cursorScope(query: WantsFeedQuery, customerId?: string): string {
  // Binding to the account prevents a cached My Wants / Joined cursor from being
  // reused after signing into a different account. Page size may change safely.
  return createHash("sha256").update(JSON.stringify([
    query.tab, query.city, query.category, query.type, query.search, accountTab(query.tab) ? customerId : null,
  ])).digest("base64url");
}

function decodeCursor(query: WantsFeedQuery): unknown {
  return JSON.parse(Buffer.from(query.cursor!, "base64url").toString("utf8"));
}

function readCursor(query: WantsFeedQuery, customerId?: string): FeedCursor | null {
  if (!query.cursor) return null;
  try {
    const cursor = decodeCursor(query) as FeedCursor;
    if (
      !cursor || cursor.version !== 1 ||
      typeof cursor.id !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(cursor.id) ||
      typeof cursor.createdAt !== "string" ||
      new Date(cursor.createdAt).toISOString() !== cursor.createdAt ||
      cursor.scope !== cursorScope(query, customerId)
    ) throw new Error("Invalid cursor");
    return cursor;
  } catch {
    throw new WantsFeedInputError("This feed cursor is invalid or belongs to different filters. Refresh the feed and try again.");
  }
}

export function readTrendingOffset(query: WantsFeedQuery): number {
  if (!query.cursor) return 0;
  try {
    const cursor = decodeCursor(query) as TrendingCursor;
    if (
      !cursor || cursor.version !== 1 || !Number.isInteger(cursor.offset) ||
      cursor.offset < 1 || cursor.offset >= TRENDING_CANDIDATE_LIMIT || cursor.scope !== cursorScope(query)
    ) throw new Error("Invalid cursor");
    return cursor.offset;
  } catch {
    throw new WantsFeedInputError("This feed cursor is invalid or belongs to different filters. Refresh the feed and try again.");
  }
}

export const wantsFeedSelect = {
  id: true,
  customerId: true,
  title: true,
  description: true,
  photo: true,
  requestType: true,
  occasion: true,
  budgetMin: true,
  budgetMax: true,
  budgetFlexible: true,
  quantity: true,
  category: true,
  city: true,
  status: true,
  createdAt: true,
  expiresAt: true,
  customer: { select: { name: true, image: true } },
  _count: { select: { offers: true } },
} satisfies Prisma.WantSelect;

export type WantsFeedRow = Prisma.WantGetPayload<{ select: typeof wantsFeedSelect }>;

function filterWhere(query: WantsFeedQuery): Prisma.WantWhereInput {
  return {
    ...(query.city ? { city: query.city } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.type ? { requestType: query.type } : {}),
    ...(query.search ? { AND: [{ OR: [{ title: { contains: query.search } }, { description: { contains: query.search } }] }] } : {}),
  };
}

function visibilityWhere(query: WantsFeedQuery, customerId: string | undefined, now: Date): Prisma.WantWhereInput {
  if (query.tab === "mine") return { customerId };
  if (query.tab === "joined") {
    // Joined Wants stay listed after they close, but never once rejected or the owner is deactivated.
    return { interests: { some: { customerId } }, status: { in: ["OPEN", "FULFILLED"] }, customer: { isActive: true } };
  }
  return { status: "OPEN", expiresAt: { gt: now }, customer: { isActive: true } };
}

export function buildWantsFeedFindMany(
  query: WantsFeedQuery,
  customerId?: string,
  now = new Date(),
) {
  if (accountTab(query.tab) && !customerId) {
    throw new WantsFeedInputError(query.tab === "mine"
      ? "Please sign in as a customer to see your Wants."
      : "Please sign in as a customer to see the Wants you joined.");
  }
  if (query.tab === "trending") throw new WantsFeedInputError("Trending is ranked separately.");
  const cursor = readCursor(query, customerId);
  const where: Prisma.WantWhereInput = {
    ...visibilityWhere(query, customerId, now),
    ...filterWhere(query),
    ...(cursor ? {
      OR: [
        { createdAt: { lt: new Date(cursor.createdAt) } },
        { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
      ],
    } : {}),
  };
  return {
    where,
    select: wantsFeedSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // One extra record tells us whether another page exists without a count or
    // fetching all matching records. Keyset pagination survives cursor deletion.
    take: query.limit + 1,
  } satisfies Prisma.WantFindManyArgs;
}

/** Candidate set for Trending: newest public Wants matching the filters, scored in memory. */
export function buildTrendingFindMany(query: WantsFeedQuery, now = new Date()) {
  return {
    where: { ...visibilityWhere(query, undefined, now), ...filterWhere(query) },
    select: wantsFeedSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: TRENDING_CANDIDATE_LIMIT,
  } satisfies Prisma.WantFindManyArgs;
}

export type InterestActivity = { total: number; recent: number; previous: number };

/** Orders by real customer demand (joins), never by vendor offers; ties fall back to newest. */
export function rankTrending(rows: WantsFeedRow[], activity: Map<string, InterestActivity>, now = new Date()) {
  return rows
    .map((row) => {
      const stats = activity.get(row.id) ?? { total: 0, recent: 0, previous: 0 };
      const ageDays = (now.getTime() - row.createdAt.getTime()) / 86400000;
      return { row, score: demandScore(stats.total, stats.recent, stats.previous, ageDays) };
    })
    .sort((a, b) => b.score - a.score || b.row.createdAt.getTime() - a.row.createdAt.getTime() || (a.row.id < b.row.id ? 1 : -1))
    .map((entry) => entry.row);
}

const noViewer: WantsFeedViewer = { actor: null, reaction: null, joined: false, isOwner: false, vendorOffer: null, canJoin: false, canOffer: false };

function toFeedItem(row: WantsFeedRow, mine: boolean, engagement?: WantEngagement): WantsFeedItem {
  const requestType = (["PRODUCT", "SERVICE", "GIFT"].includes(row.requestType) ? row.requestType : "PRODUCT") as WantRequestType;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    images: row.photo ? [row.photo] : [],
    photo: row.photo,
    requestType,
    occasion: row.occasion,
    budgetMin: row.budgetMin?.toString() ?? null,
    budgetMax: row.budgetMax?.toString() ?? null,
    budgetFlexible: row.budgetFlexible,
    quantity: row.quantity,
    category: row.category,
    city: row.city,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    customer: { name: publicDisplayName(row.customer.name), image: row.customer.image },
    joinedCount: engagement?.joinedCount ?? 0,
    offerVendorCount: engagement?.offerVendorCount ?? 0,
    reactions: engagement?.reactions ?? emptyReactionSummary(),
    viewer: engagement?.viewer ?? noViewer,
    ...(mine ? { offerCount: row._count.offers } : {}),
  };
}

export function toWantsFeedPage(
  rows: WantsFeedRow[],
  query: WantsFeedQuery,
  customerId?: string,
  engagement?: Map<string, WantEngagement>,
): WantsFeedPage {
  const page = rows.slice(0, query.limit);
  const hasMore = rows.length > query.limit;
  const last = page[page.length - 1];
  const cursor: FeedCursor | null = hasMore && last ? {
    version: 1,
    createdAt: last.createdAt.toISOString(),
    id: last.id,
    scope: cursorScope(query, customerId),
  } : null;
  return {
    wants: page.map(row => toFeedItem(row, query.tab === "mine", engagement?.get(row.id))),
    nextCursor: cursor ? Buffer.from(JSON.stringify(cursor)).toString("base64url") : null,
    hasMore,
  };
}

/** Slices an already-ranked Trending list; the cursor is an offset bound to the same filters. */
export function toTrendingPage(
  ranked: WantsFeedRow[],
  query: WantsFeedQuery,
  offset: number,
  engagement?: Map<string, WantEngagement>,
): WantsFeedPage {
  const page = ranked.slice(offset, offset + query.limit);
  const nextOffset = offset + page.length;
  const hasMore = page.length > 0 && nextOffset < ranked.length;
  const cursor: TrendingCursor | null = hasMore ? { version: 1, offset: nextOffset, scope: cursorScope(query) } : null;
  return {
    wants: page.map(row => toFeedItem(row, false, engagement?.get(row.id))),
    nextCursor: cursor ? Buffer.from(JSON.stringify(cursor)).toString("base64url") : null,
    hasMore,
  };
}
