import test from "node:test";
import assert from "node:assert/strict";
import { WantsFeedPager } from "../lib/wants-feed-client";
import type { WantsFeedItem, WantsFeedPage } from "../lib/wants-feed-types";

function item(id: string): WantsFeedItem {
  return {
    id, title: `Want ${id}`, description: "A real requirement", images: [], photo: null,
    budgetMin: null, budgetMax: "5000", budgetFlexible: false, quantity: 1,
    category: "Other", city: "Lahore", status: "OPEN", createdAt: "2026-10-08T08:00:00.000Z",
    expiresAt: "2026-11-08T08:00:00.000Z", customer: { name: "Customer", image: null },
  };
}

function fixture() {
  const requests: Array<{
    url: URL;
    signal: AbortSignal | null | undefined;
    succeed: (page: WantsFeedPage) => void;
    fail: (message: string, status?: number) => void;
    reject: (error: Error) => void;
  }> = [];
  const fetcher: typeof fetch = (input, options) => new Promise<Response>((resolve, reject) => {
    requests.push({
      url: new URL(input instanceof Request ? input.url : String(input), "https://joro.test"),
      signal: options?.signal,
      succeed: page => resolve(new Response(JSON.stringify(page), { status: 200, headers: { "Content-Type": "application/json" } })),
      fail: (error, status = 500) => resolve(new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } })),
      reject,
    });
  });
  return { pager: new WantsFeedPager(fetcher), requests };
}

const page = (ids: string[], nextCursor: string | null = null): WantsFeedPage => ({ wants: ids.map(item), nextCursor, hasMore: nextCursor !== null });
const ids = (pager: WantsFeedPager) => pager.getSnapshot().items.map(want => want.id);

test("initial and next-page requests lock synchronously and each page appends once", async () => {
  const { pager, requests } = fixture();
  const initial = pager.reset("tab=all&limit=10");
  assert.equal(pager.getSnapshot().loading, true);
  const initialOverlap = [pager.loadMore(), pager.loadMore()];
  await Promise.resolve();
  assert.equal(requests.length, 1, "scroll callbacks cannot overlap initial loading");
  assert.equal(requests[0].url.pathname, "/api/wants/feed");
  assert.equal(requests[0].url.searchParams.get("limit"), "10");
  requests[0].succeed(page(["a", "a", "b"], "cursor-one")); await initial; await Promise.all(initialOverlap);
  assert.deepEqual(ids(pager), ["a", "b"], "duplicate IDs within a page are removed");
  assert.equal(pager.getSnapshot().loading, false);
  assert.equal(pager.getSnapshot().initialized, true);

  const firstScroll = pager.loadMore(), overlappingScroll = pager.loadMore();
  await Promise.resolve();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].url.searchParams.get("cursor"), "cursor-one");
  assert.equal(pager.getSnapshot().loadingMore, true);
  assert.equal(pager.getSnapshot().loading, false);
  requests[1].succeed(page(["b", "c", "c"])); await Promise.all([firstScroll, overlappingScroll]);
  assert.deepEqual(ids(pager), ["a", "b", "c"]);
  assert.equal(pager.getSnapshot().loadingMore, false);
  assert.equal(pager.getSnapshot().hasMore, false);
  await pager.loadMore(); assert.equal(requests.length, 2, "an exhausted feed makes no more requests");
  pager.dispose();
});

test("changing filters aborts the previous request and ignores even a late successful response", async () => {
  const { pager, requests } = fixture();
  const old = pager.reset("tab=all&city=Lahore");
  await Promise.resolve();
  const current = pager.reset("tab=nearby&city=Karachi");
  await Promise.resolve();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].signal?.aborted, true);
  assert.equal(requests[1].url.searchParams.get("city"), "Karachi");
  requests[1].succeed(page(["karachi"])); await current;
  requests[0].succeed(page(["lahore"], "stale-cursor")); await old;
  assert.deepEqual(ids(pager), ["karachi"]);
  assert.equal(pager.getSnapshot().nextCursor, null);
  assert.equal(pager.getSnapshot().hasMore, false);
  assert.equal(pager.getSnapshot().loading, false);
  pager.dispose();
});

test("a synchronous subscriber cannot re-enter next-page loading and duplicate the request", async () => {
  const { pager, requests } = fixture();
  const initial = pager.reset("tab=all"); await Promise.resolve(); requests[0].succeed(page(["a"], "cursor")); await initial;
  let reentered = false;
  const unsubscribe = pager.subscribe(() => {
    if (pager.getSnapshot().loadingMore && !reentered) { reentered = true; void pager.loadMore(); }
  });
  const more = pager.loadMore(); await Promise.resolve();
  assert.equal(reentered, true);
  assert.equal(requests.length, 2, "only one next-page fetch was dispatched");
  requests[1].succeed(page(["b"])); await more;
  assert.deepEqual(ids(pager), ["a", "b"]);
  unsubscribe(); pager.dispose();
});

test("late next-page failures cannot replace a new filter's success", async () => {
  const { pager, requests } = fixture();
  const initial = pager.reset("tab=all"); await Promise.resolve(); requests[0].succeed(page(["old"], "old-cursor")); await initial;
  const oldMore = pager.loadMore();
  await Promise.resolve();
  const current = pager.reset("tab=all&city=Islamabad");
  await Promise.resolve();
  requests[2].succeed(page(["current"])); await current;
  requests[1].fail("Stale server failure"); await oldMore;
  assert.deepEqual(ids(pager), ["current"]);
  assert.equal(pager.getSnapshot().error, "");
  assert.equal(pager.getSnapshot().moreError, "");
  pager.dispose();
});

test("initial failure exposes retry and retry uses the same filters", async () => {
  const { pager, requests } = fixture();
  const first = pager.reset("tab=nearby&city=Lahore");
  await Promise.resolve();
  requests[0].fail("Feed temporarily unavailable"); await first;
  assert.equal(pager.getSnapshot().loading, false);
  assert.match(pager.getSnapshot().error, /Feed temporarily unavailable/);
  assert.deepEqual(ids(pager), []);
  const retry = pager.retry();
  await Promise.resolve();
  assert.equal(pager.getSnapshot().loading, true);
  assert.match(pager.getSnapshot().error, /Feed temporarily unavailable/, "the retry panel remains mounted while the retry is pending");
  assert.equal(requests[1].url.search, requests[0].url.search);
  requests[1].succeed(page(["retried"])); await retry;
  assert.deepEqual(ids(pager), ["retried"]);
  assert.equal(pager.getSnapshot().error, "");
  pager.dispose();
});

test("next-page failure retains existing posts and retry requests the same cursor", async () => {
  const { pager, requests } = fixture();
  const initial = pager.reset("tab=all"); await Promise.resolve(); requests[0].succeed(page(["a", "b"], "second-page")); await initial;
  const more = pager.loadMore(); await Promise.resolve(); requests[1].fail("Try this page again", 503); await more;
  assert.deepEqual(ids(pager), ["a", "b"]);
  assert.equal(pager.getSnapshot().loadingMore, false);
  assert.match(pager.getSnapshot().moreError, /Try this page again/);
  assert.equal(pager.getSnapshot().nextCursor, "second-page");
  const retry = pager.retry();
  await Promise.resolve();
  assert.match(pager.getSnapshot().moreError, /Try this page again/, "the next-page retry button remains mounted while retrying");
  assert.equal(requests[2].url.searchParams.get("cursor"), "second-page");
  requests[2].succeed(page(["b", "c"])); await retry;
  assert.deepEqual(ids(pager), ["a", "b", "c"]);
  assert.equal(pager.getSnapshot().moreError, "");
  pager.dispose();
});

test("an empty successful feed completes cleanly without automatic repeated fetches", async () => {
  const { pager, requests } = fixture();
  const initial = pager.reset("tab=all"); await Promise.resolve(); requests[0].succeed(page([])); await initial;
  assert.deepEqual(ids(pager), []);
  assert.equal(pager.getSnapshot().initialized, true);
  assert.equal(pager.getSnapshot().hasMore, false);
  assert.equal(pager.getSnapshot().error, "");
  await pager.loadMore(); await pager.loadMore(); assert.equal(requests.length, 1);
  pager.dispose();
});

test("network failures get a readable message and malformed repeated cursors cannot loop forever", async () => {
  const { pager, requests } = fixture();
  const initial = pager.reset("tab=all"); await Promise.resolve();
  requests[0].reject(new Error("Failed to fetch")); await initial;
  assert.match(pager.getSnapshot().error, /connection|connect/i);
  const retry = pager.retry(); await Promise.resolve();
  requests[1].succeed(page(["a"], "cursor-one")); await retry;
  const more = pager.loadMore(); await Promise.resolve();
  requests[2].succeed(page(["b"], "cursor-one")); await more;
  assert.deepEqual(ids(pager), ["a"], "a malformed page does not alter the feed");
  assert.ok(pager.getSnapshot().moreError);
  assert.equal(pager.getSnapshot().loadingMore, false);
  const retryPage = pager.retry(); await Promise.resolve();
  assert.equal(requests[3].url.searchParams.get("cursor"), "cursor-one");
  requests[3].succeed(page(["b"])); await retryPage;
  assert.deepEqual(ids(pager), ["a", "b"]);
  pager.dispose();
});

test("restored pages preserve loaded items and continue from their saved cursor", async () => {
  const { pager, requests } = fixture();
  await pager.reset("tab=all&city=Lahore", { items: [item("a"), item("b")], nextCursor: "restored-cursor", hasMore: true });
  assert.deepEqual(ids(pager), ["a", "b"]);
  assert.equal(requests.length, 0, "back navigation can restore without flashing initial skeletons");
  assert.equal(pager.getSnapshot().initialized, true);
  const more = pager.loadMore();
  await Promise.resolve();
  assert.equal(requests[0].url.searchParams.get("cursor"), "restored-cursor");
  requests[0].succeed(page(["c"])); await more;
  assert.deepEqual(ids(pager), ["a", "b", "c"]);
  pager.dispose();
});

test("disposing aborts in-flight work and stops notifying unmounted consumers", async () => {
  const { pager, requests } = fixture();
  let notifications = 0;
  const unsubscribe = pager.subscribe(() => { notifications++; });
  const initial = pager.reset("tab=all");
  await Promise.resolve();
  assert.ok(notifications > 0);
  pager.dispose();
  assert.equal(requests[0].signal?.aborted, true);
  const count = notifications;
  requests[0].succeed(page(["late"])); await initial;
  assert.equal(notifications, count);
  assert.deepEqual(ids(pager), []);
  unsubscribe();
});
