import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  WANT_REACTIONS,
  isWantReaction,
  offerStatusLabel,
  publicDisplayName,
  relativeTime,
  summarizeReactions,
  topReactions,
} from "../lib/want-social";
import {
  buildTrendingFindMany,
  buildWantsFeedFindMany,
  parseWantsFeedQuery,
  rankTrending,
  readTrendingOffset,
  toTrendingPage,
  toWantsFeedPage,
  TRENDING_CANDIDATE_LIMIT,
  WantsFeedInputError,
  type WantsFeedRow,
} from "../lib/wants-feed";
import { wantInput } from "../lib/want-schema";

const now = new Date("2026-10-14T09:00:00.000Z");
const parse = (search = "") => parseWantsFeedQuery(new URLSearchParams(search));
function row(id: string, overrides: Partial<WantsFeedRow> = {}): WantsFeedRow {
  return {
    id, customerId: `owner-${id}`, createdAt: now, title: "Sofa set", description: "Need a 5 seater sofa.",
    photo: null, requestType: "PRODUCT", occasion: null, budgetMin: new Prisma.Decimal("40000"), budgetMax: new Prisma.Decimal("60000"),
    budgetFlexible: false, quantity: 1, category: "Furniture", city: "Lahore", status: "OPEN",
    expiresAt: new Date("2026-11-14T09:00:00.000Z"), customer: { name: "Ayesha Khan", image: null }, _count: { offers: 3 },
    ...overrides,
  };
}

test("exactly five reactions are available, in the agreed order", () => {
  assert.deepEqual(WANT_REACTIONS.map(r => r.type), ["LIKE", "LOVE", "SUPPORT", "WOW", "FIRE"]);
  assert.deepEqual(WANT_REACTIONS.map(r => r.emoji), ["👍", "❤️", "🙌", "😮", "🔥"]);
  for (const type of ["LIKE", "LOVE", "SUPPORT", "WOW", "FIRE"]) assert.equal(isWantReaction(type), true);
  for (const value of ["ANGRY", "like", "", null, 1, { type: "LIKE" }]) assert.equal(isWantReaction(value), false, String(value));
});

test("reaction summaries total each type and ignore unknown or empty rows", () => {
  const summary = summarizeReactions([{ type: "LIKE", count: 4 }, { type: "FIRE", count: 2 }, { type: "ANGRY", count: 9 }, { type: "LOVE", count: 0 }]);
  assert.equal(summary.total, 6);
  assert.deepEqual(summary.counts, { LIKE: 4, LOVE: 0, SUPPORT: 0, WOW: 0, FIRE: 2 });
  assert.deepEqual(topReactions(summary).map(r => r.type), ["LIKE", "FIRE"]);
});

test("public display names never reveal a full name", () => {
  assert.equal(publicDisplayName("Ayesha Khan"), "Ayesha K.");
  assert.equal(publicDisplayName("  muhammad   ali   raza "), "muhammad R.");
  assert.equal(publicDisplayName("Ayesha"), "Ayesha");
  assert.equal(publicDisplayName(""), "JORO member");
  assert.equal(publicDisplayName(null), "JORO member");
});

test("relative time reads naturally", () => {
  const at = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString();
  assert.equal(relativeTime(at(10_000), now.getTime()), "just now");
  assert.equal(relativeTime(at(5 * 60_000), now.getTime()), "5m ago");
  assert.equal(relativeTime(at(3 * 3_600_000), now.getTime()), "3h ago");
  assert.equal(relativeTime(at(2 * 86_400_000), now.getTime()), "2d ago");
});

test("stored offer statuses map onto the workflow labels without rewriting history", () => {
  const future = new Date(now.getTime() + 86_400_000);
  const past = new Date(now.getTime() - 1);
  assert.equal(offerStatusLabel({ status: "SUBMITTED", version: 1, latestExpiresAt: future }, now.getTime()), "Submitted");
  assert.equal(offerStatusLabel({ status: "SUBMITTED", version: 3, latestExpiresAt: future }, now.getTime()), "Revised");
  assert.equal(offerStatusLabel({ status: "COUNTERED", version: 2, latestExpiresAt: future }, now.getTime()), "Countered");
  assert.equal(offerStatusLabel({ status: "ACCEPTED", latestExpiresAt: past }, now.getTime()), "Accepted");
  assert.equal(offerStatusLabel({ status: "REJECTED" }, now.getTime()), "Rejected");
  assert.equal(offerStatusLabel({ status: "WITHDRAWN" }, now.getTime()), "Withdrawn");
  assert.equal(offerStatusLabel({ status: "SUBMITTED", version: 1, latestExpiresAt: past }, now.getTime()), "Expired");
});

test("a Want accepts at most one safe image reference", () => {
  const base = { title: "Need a sofa", category: "Furniture", city: "Lahore", budgetFlexible: true, budgetMin: null, budgetMax: null, quantity: 1 };
  assert.equal(wantInput.safeParse({ ...base, photo: "/uploads/wants/want-1789-ab12.png" }).success, true);
  for (const photo of [
    ["/uploads/wants/a.png", "/uploads/wants/b.png"],
    "/uploads/wants/../products/x.png",
    "/uploads/wants/sub/x.png",
    "/uploads/wants/x.png?y=1",
    "/uploads/wants/x.svg",
    "https://evil.example/x.png",
  ]) assert.equal(wantInput.safeParse({ ...base, photo }).success, false, JSON.stringify(photo));
});

test("feed tabs, type and search are validated before any query", () => {
  assert.equal(parse("tab=trending").tab, "trending");
  assert.equal(parse("tab=joined").tab, "joined");
  assert.equal(parse("type=service").type, "SERVICE");
  assert.equal(parse("q=%20sofa%20").search, "sofa");
  for (const search of ["tab=reported", "type=LISTING", `q=${"a".repeat(101)}`]) assert.throws(() => parse(search), WantsFeedInputError, search);
});

test("type, city, category and search all narrow the public feed server-side", () => {
  const args = buildWantsFeedFindMany(parse("type=GIFT&city=Lahore&category=Furniture&q=sofa"), undefined, now);
  assert.deepEqual(args.where, {
    status: "OPEN", expiresAt: { gt: now }, customer: { isActive: true },
    city: "Lahore", category: "Furniture", requestType: "GIFT",
    AND: [{ OR: [{ title: { contains: "sofa" } }, { description: { contains: "sofa" } }] }],
  });
});

test("Joined lists only the signed-in customer's joins and never rejected Wants", () => {
  assert.throws(() => buildWantsFeedFindMany(parse("tab=joined")), WantsFeedInputError);
  assert.deepEqual(buildWantsFeedFindMany(parse("tab=joined"), "customer-a", now).where, {
    interests: { some: { customerId: "customer-a" } }, status: { in: ["OPEN", "FULFILLED"] }, customer: { isActive: true },
  });
});

test("Trending candidates are public-only and capped", () => {
  const args = buildTrendingFindMany(parse("tab=trending&city=Lahore"), now);
  assert.deepEqual(args.where, { status: "OPEN", expiresAt: { gt: now }, customer: { isActive: true }, city: "Lahore" });
  assert.equal(args.take, TRENDING_CANDIDATE_LIMIT);
});

test("Trending ranks by customer joins, never by vendor offers", () => {
  const busyOffers = row("offers-only", { _count: { offers: 50 } });
  const demanded = row("demanded", { createdAt: new Date(now.getTime() - 86_400_000), _count: { offers: 0 } });
  const quiet = row("quiet", { createdAt: new Date(now.getTime() - 3_600_000) });
  const ranked = rankTrending([busyOffers, demanded, quiet], new Map([["demanded", { total: 6, recent: 4, previous: 1 }]]), now);
  assert.equal(ranked[0].id, "demanded");
  assert.deepEqual(ranked.slice(1).map(r => r.id), ["offers-only", "quiet"], "zero-demand ties fall back to newest first");
});

test("Trending pages use an offset cursor bound to the same filters", () => {
  const query = parse("tab=trending&limit=2");
  const ranked = ["a", "b", "c"].map(id => row(id));
  const first = toTrendingPage(ranked, query, 0);
  assert.deepEqual(first.wants.map(w => w.id), ["a", "b"]);
  assert.equal(first.hasMore, true);
  const next = { ...query, cursor: first.nextCursor };
  assert.equal(readTrendingOffset(next), 2);
  const second = toTrendingPage(ranked, next, 2);
  assert.deepEqual(second.wants.map(w => w.id), ["c"]);
  assert.equal(second.hasMore, false);
  assert.throws(() => readTrendingOffset({ ...parse("tab=trending&type=GIFT"), cursor: first.nextCursor }), WantsFeedInputError);
});

test("public feed items expose aggregates only — no owner id, offer details or full names", () => {
  const page = toWantsFeedPage([row("w1")], parse());
  const item = page.wants[0];
  assert.equal(item.customer.name, "Ayesha K.");
  assert.equal("customerId" in item, false);
  assert.equal("offerCount" in item, false, "per-offer counts are only for the owner's My Wants tab");
  assert.equal(item.offerVendorCount, 0);
  assert.equal(item.joinedCount, 0);
  assert.equal(item.reactions.total, 0);
  assert.equal(item.viewer.vendorOffer, null);
  assert.equal(JSON.stringify(item).includes("price"), false);
  assert.equal(toWantsFeedPage([row("w1")], parse("tab=mine"), "owner-w1").wants[0].offerCount, 3);
});
