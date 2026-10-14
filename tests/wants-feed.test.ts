import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  buildWantsFeedFindMany,
  parseWantsFeedQuery,
  toWantsFeedPage,
  WantsFeedInputError,
  type WantsFeedRow,
} from "../lib/wants-feed";

const now = new Date("2026-10-08T09:00:00.000Z");
const parse = (search = "") => parseWantsFeedQuery(new URLSearchParams(search));
function row(id: string, createdAt = now): WantsFeedRow {
  return {
    id, createdAt, customerId: "customer-owner", requestType: "PRODUCT", occasion: null, title: "Office chair", description: "Looking for a comfortable chair.",
    photo: null, budgetMin: new Prisma.Decimal("1200.50"), budgetMax: null,
    budgetFlexible: true, quantity: 2, category: "Furniture", city: "Lahore", status: "OPEN",
    expiresAt: new Date("2026-11-08T09:00:00.000Z"), customer: { name: "Ayesha", image: null }, _count: { offers: 0 },
  };
}

test("public Wants require approval, a future expiry, and an active customer", () => {
  const args = buildWantsFeedFindMany(parse(), undefined, now);
  assert.deepEqual(args.where, {
    status: "OPEN", expiresAt: { gt: now }, customer: { isActive: true },
  });
  assert.deepEqual(args.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.equal(args.take, 11);
  assert.equal("skip" in args, false);
});

test("My Wants is restricted to the signed-in customer, including their pending posts", () => {
  const query = parse("tab=mine");
  assert.throws(() => buildWantsFeedFindMany(query), WantsFeedInputError);
  assert.deepEqual(buildWantsFeedFindMany(query, "customer-a").where, { customerId: "customer-a" });
});

test("Nearby and city/category filters constrain server-side results", () => {
  assert.throws(() => parse("tab=nearby"), /Choose a city/);
  const args = buildWantsFeedFindMany(parse("tab=nearby&city=%20Lahore%20&category=Furniture"), undefined, now);
  assert.deepEqual(args.where, {
    status: "OPEN", expiresAt: { gt: now }, customer: { isActive: true }, city: "Lahore", category: "Furniture",
  });
});

test("invalid filters and page sizes are rejected before a database query", () => {
  for (const search of ["tab=private", "limit=0", "limit=21", "limit=1.5", "limit=NaN", "limit=-1", `city=${"a".repeat(101)}`, `category=${"a".repeat(101)}`]) {
    assert.throws(() => parse(search), WantsFeedInputError, search);
  }
  assert.equal(buildWantsFeedFindMany(parse("limit=20")).take, 21);
});

test("a lookahead record creates a deterministic cursor without entering the current page", () => {
  const query = parse("limit=2");
  const result = toWantsFeedPage([row("want-c"), row("want-b"), row("want-a")], query);
  assert.deepEqual(result.wants.map(want => want.id), ["want-c", "want-b"]);
  assert.equal(result.hasMore, true);
  assert.ok(result.nextCursor);
  const nextQuery = { ...query, cursor: result.nextCursor };
  const nextArgs = buildWantsFeedFindMany(nextQuery, undefined, now);
  assert.deepEqual(nextArgs.where.OR, [
    { createdAt: { lt: now } },
    { createdAt: now, id: { lt: "want-b" } },
  ]);
  // The same timestamp uses the id as a tie-breaker. Newly inserted rows and the
  // previous page cannot be repeated, even if the cursor record was removed.
  const remaining = [row("want-new", new Date(now.getTime() + 1)), row("want-c"), row("want-a"), row("want-old", new Date(now.getTime() - 1))]
    .filter(want => want.createdAt < now || (want.createdAt.getTime() === now.getTime() && want.id < "want-b"));
  const next = toWantsFeedPage(remaining, nextQuery);
  assert.deepEqual(next.wants.map(want => want.id), ["want-a", "want-old"]);
  assert.equal(next.hasMore, false);
  assert.equal(next.nextCursor, null);
});

test("exact-size and empty final pages do not advertise another request", () => {
  const query = parse("limit=2");
  assert.deepEqual(toWantsFeedPage([], query), { wants: [], hasMore: false, nextCursor: null });
  const page = toWantsFeedPage([row("want-b"), row("want-a")], query);
  assert.equal(page.hasMore, false);
  assert.equal(page.nextCursor, null);
});

test("cursors cannot be reused across tabs, filters, or My Wants accounts", () => {
  const query = parse("tab=mine&city=Lahore&limit=1");
  const cursor = toWantsFeedPage([row("want-b"), row("want-a")], query, "customer-a").nextCursor;
  assert.ok(cursor);
  for (const changed of [{ ...query, tab: "all" as const }, { ...query, city: "Karachi" }, { ...query, category: "Books" }]) {
    assert.throws(() => buildWantsFeedFindMany({ ...changed, cursor }, "customer-a"), WantsFeedInputError);
  }
  assert.throws(() => buildWantsFeedFindMany({ ...query, cursor }, "customer-b"), WantsFeedInputError);
  assert.doesNotThrow(() => buildWantsFeedFindMany({ ...query, cursor, limit: 20 }, "customer-a"));
});

test("malformed and invalid cursor payloads fail with a retryable input error", () => {
  for (const cursor of ["!bad", "a".repeat(2049)]) assert.throws(() => parse(`cursor=${cursor}`), WantsFeedInputError);
  for (const value of ["garbage", "null", "{}", '{"version":1,"createdAt":"invalid","id":"want-a"}']) {
    const cursor = Buffer.from(value).toString("base64url");
    assert.throws(() => buildWantsFeedFindMany({ ...parse(), cursor }), WantsFeedInputError);
  }
});

test("feed serialization uses real photos or no image and omits private database fields", () => {
  const query = parse();
  const withPhoto = { ...row("want-photo"), photo: "/uploads/wants/chair.png" };
  const privateRow = { ...withPhoto, customerId: "private-id", moderationReason: "Internal note", customer: { name: "Ayesha", image: "/uploads/avatar.png", email: "private@example.com", phone: "03001234567" } };
  const page = toWantsFeedPage([privateRow, row("want-text")], query);
  assert.deepEqual(page.wants[0].images, ["/uploads/wants/chair.png"]);
  assert.deepEqual(page.wants[1].images, []);
  assert.deepEqual(page.wants[0].customer, { name: "Ayesha", image: "/uploads/avatar.png" });
  assert.equal(page.wants[0].budgetMin, "1200.5");
  assert.equal(page.wants[0].budgetMax, null);
  assert.equal(page.wants[0].createdAt, now.toISOString());
  assert.equal("customerId" in page.wants[0], false);
  assert.equal("moderationReason" in page.wants[0], false);
  assert.equal("email" in page.wants[0].customer, false);
  assert.equal("phone" in page.wants[0].customer, false);
});
