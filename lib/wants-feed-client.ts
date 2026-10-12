import type { WantsFeedItem, WantsFeedPage } from "./wants-feed-types";

export type FeedSnapshot = {
  items: WantsFeedItem[]; nextCursor: string | null; hasMore: boolean;
  loading: boolean; loadingMore: boolean; error: string; moreError: string; initialized: boolean;
};
export type RestoredFeed = Pick<FeedSnapshot, "items" | "nextCursor" | "hasMore">;
const empty = (): FeedSnapshot => ({ items: [], nextCursor: null, hasMore: true, loading: false, loadingMore: false, error: "", moreError: "", initialized: false });

/** Request ownership lives outside rendering so rapid clicks/observer callbacks cannot overlap. */
export class WantsFeedPager {
  private snapshot = empty();
  private listeners = new Set<() => void>();
  private query = "";
  private generation = 0;
  private controller: AbortController | null = null;
  private active: Promise<void> | null = null;
  private requesting = false;
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<FeedSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener()); }
  reset(query: string, restored?: RestoredFeed) {
    this.dispose(); this.query = query; this.snapshot = empty();
    if (restored) { this.update({ ...restored, initialized: true }); return Promise.resolve(); }
    return this.request(false);
  }
  clear() { this.dispose(); this.snapshot = empty(); this.update({ hasMore: false, initialized: true }); }
  /** Applies a local edit (e.g. a deleted or closed Want) without refetching the feed. */
  mapItems(fn: (items: WantsFeedItem[]) => WantsFeedItem[]) { if (this.snapshot.initialized) this.update({ items: fn(this.snapshot.items) }); }
  dispose() { this.generation++; this.controller?.abort(); this.controller = null; this.active = null; this.requesting = false; }
  loadMore = () => {
    if (this.active) return this.active;
    if (this.requesting) return Promise.resolve();
    if (!this.snapshot.initialized || !this.snapshot.hasMore || !this.snapshot.nextCursor || this.snapshot.error) return Promise.resolve();
    return this.request(true);
  };
  retry = () => this.active || (this.snapshot.error || !this.snapshot.initialized ? this.request(false) : this.loadMore());

  private request(more: boolean) {
    if (this.active) return this.active;
    if (this.requesting) return Promise.resolve();
    this.requesting = true;
    const version = ++this.generation;
    const controller = new AbortController(); this.controller = controller;
    const cursor = more ? this.snapshot.nextCursor : null;
    const params = new URLSearchParams(this.query);
    params.set("limit", "10");
    if (cursor) params.set("cursor", cursor);
    this.update(more ? { loadingMore: true } : { loading: true });
    // Install the promise before starting fetch, including synchronously re-entrant callers.
    const request = Promise.resolve().then(async () => {
      try {
        const response = await this.fetcher(`/api/wants/feed?${params}`, { signal: controller.signal, cache: "no-store", credentials: "same-origin" });
        const data = await response.json() as WantsFeedPage & { error?: string };
        if (!response.ok) throw new Error(data.error || "Wants could not be loaded. Please try again.");
        if (!Array.isArray(data.wants) || typeof data.hasMore !== "boolean" || (data.hasMore && (!data.nextCursor || data.nextCursor === cursor))) throw new Error("The feed could not be loaded. Please try again.");
        if (version !== this.generation || controller.signal.aborted) return;
        const items = more ? [...this.snapshot.items] : [];
        const seen = new Set(items.map(item => item.id));
        for (const item of data.wants) if (item.id && !seen.has(item.id)) { seen.add(item.id); items.push(item); }
        this.update({ items, nextCursor: data.nextCursor, hasMore: data.hasMore, initialized: true, error: "", moreError: "" });
      } catch (error) {
        if (version !== this.generation || controller.signal.aborted) return;
        const message = error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Couldn't connect. Check your connection and try again.";
        this.update(more ? { moreError: message } : { error: message, initialized: true });
      } finally {
        if (version === this.generation) { this.active = null; this.controller = null; this.requesting = false; this.update({ loading: false, loadingMore: false }); }
      }
    });
    this.active = request;
    return request;
  }
}
