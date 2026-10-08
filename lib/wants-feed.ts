import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { WantsFeedItem, WantsFeedPage, WantsFeedTab } from "./wants-feed-types";

export const WANTS_FEED_DEFAULT_LIMIT = 10;
export const WANTS_FEED_MAX_LIMIT = 20;

export class WantsFeedInputError extends Error {}

export type WantsFeedQuery = {
  tab: WantsFeedTab;
  city: string;
  category: string;
  limit: number;
  cursor: string | null;
};

type FeedCursor = { version: 1; createdAt: string; id: string; scope: string };

export function parseWantsFeedQuery(params: URLSearchParams): WantsFeedQuery {
  const tab = params.get("tab") || "all";
  if (tab !== "all" && tab !== "nearby" && tab !== "mine") {
    throw new WantsFeedInputError("Choose All Wants, Nearby, or My Wants.");
  }
  const city = (params.get("city") || "").trim();
  const category = (params.get("category") || "").trim();
  if (city.length > 100 || category.length > 100) {
    throw new WantsFeedInputError("City and category must be 100 characters or fewer.");
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
  return { tab, city, category, limit, cursor };
}

function cursorScope(query: WantsFeedQuery, customerId?: string): string {
  // Binding to the account prevents a cached My Wants cursor from being reused
  // after signing into a different account. Page size may change safely.
  return createHash("sha256").update(JSON.stringify([
    query.tab, query.city, query.category, query.tab === "mine" ? customerId : null,
  ])).digest("base64url");
}

function readCursor(query: WantsFeedQuery, customerId?: string): FeedCursor | null {
  if (!query.cursor) return null;
  try {
    const cursor = JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")) as FeedCursor;
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

export const wantsFeedSelect = {
  id: true,
  title: true,
  description: true,
  photo: true,
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
} satisfies Prisma.WantSelect;

export type WantsFeedRow = Prisma.WantGetPayload<{ select: typeof wantsFeedSelect }>;

export function buildWantsFeedFindMany(
  query: WantsFeedQuery,
  customerId?: string,
  now = new Date(),
) {
  if (query.tab === "mine" && !customerId) {
    throw new WantsFeedInputError("Please sign in as a customer to see your Wants.");
  }
  const cursor = readCursor(query, customerId);
  const where: Prisma.WantWhereInput = {
    ...(query.tab === "mine"
      ? { customerId }
      : { status: "OPEN", expiresAt: { gt: now }, customer: { isActive: true } }),
    ...(query.city ? { city: query.city } : {}),
    ...(query.category ? { category: query.category } : {}),
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

function toFeedItem(row: WantsFeedRow): WantsFeedItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    images: row.photo ? [row.photo] : [],
    photo: row.photo,
    budgetMin: row.budgetMin?.toString() ?? null,
    budgetMax: row.budgetMax?.toString() ?? null,
    budgetFlexible: row.budgetFlexible,
    quantity: row.quantity,
    category: row.category,
    city: row.city,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    customer: { name: row.customer.name || "JORO member", image: row.customer.image },
  };
}

export function toWantsFeedPage(
  rows: WantsFeedRow[],
  query: WantsFeedQuery,
  customerId?: string,
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
    wants: page.map(toFeedItem),
    nextCursor: cursor ? Buffer.from(JSON.stringify(cursor)).toString("base64url") : null,
    hasMore,
  };
}
