"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, CalendarClock, CheckCircle2, Flame, Gift, Handshake, ListFilter, MapPin, MessageSquareText, Package, Plus, RotateCcw, Search, UserRound, Wrench } from "lucide-react";
import Link from "@/components/ui/LoadingLink";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { PostWantButton } from "@/components/user/PostWantButton";
import { WantOwnerActions } from "@/components/user/WantOwnerActions";
import { WantReportMenu, WantSocialBar } from "@/components/wants/WantSocialBar";
import { usePageLoading } from "@/hooks/usePageLoading";
import { WantsFeedPager, type RestoredFeed } from "@/lib/wants-feed-client";
import type { WantRequestType, WantsFeedItem, WantsFeedTab } from "@/lib/wants-feed-types";
import { relativeTime, WANT_TYPE_LABELS } from "@/lib/want-social";
import styles from "./WantsFeed.module.css";

type CachedFeed = RestoredFeed & { scrollY: number; savedAt: number; resume: boolean };
type Filters = { tab: WantsFeedTab; city: string; category: string; type: WantRequestType | ""; q: string };
const memory = new Map<string, CachedFeed>();
const storagePrefix = "joro-wants-feed-v2:";
const cities = ["Islamabad", "Karachi", "Lahore", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Taxila"];
const TABS = [
  { id: "all", label: "Latest", Icon: MessageSquareText },
  { id: "trending", label: "Trending", Icon: Flame },
  { id: "mine", label: "My Wants", Icon: UserRound },
  { id: "joined", label: "Joined", Icon: Handshake },
] as const;
const TYPES = [
  { id: "", label: "All", Icon: ListFilter },
  { id: "PRODUCT", label: "Products", Icon: Package },
  { id: "SERVICE", label: "Services", Icon: Wrench },
  { id: "GIFT", label: "Gifts", Icon: Gift },
] as const;

function queryFor({ tab, city, category, type, q }: Filters) {
  const params = new URLSearchParams({ tab });
  if (city.trim()) params.set("city", city.trim());
  if (category) params.set("category", category);
  if (type) params.set("type", type);
  if (q.trim()) params.set("q", q.trim());
  return params.toString();
}
function restore(key: string): CachedFeed | null {
  try {
    const cached = memory.get(key) || JSON.parse(sessionStorage.getItem(storagePrefix + key) || "null") as CachedFeed | null;
    if (!cached?.resume || !Array.isArray(cached.items) || Date.now() - cached.savedAt > 600000) return null;
    cached.resume = false; memory.set(key, cached); sessionStorage.removeItem(storagePrefix + key);
    return cached;
  } catch { return null; }
}
/** Budget only when the customer shared one; "flexible" posts don't show a figure. */
function budget(want: WantsFeedItem) {
  if (want.budgetFlexible) return null;
  const min = Number(want.budgetMin || 0), max = Number(want.budgetMax || 0);
  const money = (value: number) => `PKR ${value.toLocaleString("en-PK")}`;
  if (min && max && min !== max) return `${money(min)} – ${money(max)}`;
  return max ? `Up to ${money(max)}` : min ? `From ${money(min)}` : null;
}
function statusFor(want: WantsFeedItem) {
  if (["PENDING_MODERATION", "SUBMITTED"].includes(want.status)) return { label: "Pending review", tone: "pending" };
  if (want.status === "DRAFT") return { label: "Draft", tone: "pending" };
  if (want.status === "OPEN" && new Date(want.expiresAt).getTime() > Date.now()) return { label: "Open", tone: "open" };
  if (want.status === "OPEN") return { label: "Expired", tone: "closed" };
  return { label: want.status.charAt(0) + want.status.slice(1).toLowerCase().replaceAll("_", " "), tone: "closed" };
}
const TYPE_ICONS = { PRODUCT: Package, SERVICE: Wrench, GIFT: Gift } as const;

export function WantsFeedSkeleton({ more = false }: { more?: boolean }) {
  usePageLoading(!more);
  return <div className={styles.list} role="status" aria-label={more ? "Loading more Wants…" : "Loading Wants…"} aria-busy="true">
    {[0, 1].map(index => <div key={index} className={styles.card} aria-hidden="true"><div className={styles.cardBody}>
      <div className={styles.postHeader}><div className={`${styles.avatar} ${styles.pulse}`} /><div><div className={`${styles.pulse} ${styles.skeletonAuthor}`} /><div className={`${styles.pulse} ${styles.skeletonMeta}`} /></div></div>
      <div className={`${styles.pulse} ${styles.skeletonTitle}`} /><div className={`${styles.pulse} ${styles.skeletonLine}`} /><div className={`${styles.pulse} ${styles.skeletonLine}`} />
      {index === 0 && <div className={`${styles.pulse} ${styles.skeletonImage}`} />}<div className={`${styles.pulse} ${styles.skeletonFooter}`} />
    </div></div>)}
  </div>;
}

function FeedPost({ want, href, onDetails, mine }: { want: WantsFeedItem; href: string; onDetails: () => void; mine: boolean }) {
  const status = statusFor(want);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // One primary image per Want: older records are never altered, only the first image is shown.
  const photo = want.images[0] || want.photo;
  const initials = want.customer.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const TypeIcon = TYPE_ICONS[want.requestType] || Package;
  const shownBudget = budget(want);
  const longText = (want.description?.length || 0) > 280;
  return <article className={styles.card} data-want-post={want.id} aria-labelledby={`want-${want.id}`}>
    <div className={styles.cardBody}><header className={styles.postHeader}>
      <div className={styles.avatar}>{want.customer.image && !avatarFailed ? <Image src={want.customer.image} alt="" width={43} height={43} unoptimized onError={() => setAvatarFailed(true)} /> : <span aria-hidden="true">{initials || "J"}</span>}</div>
      <div className={styles.author}><strong>{want.customer.name}</strong><div className={styles.meta}>
        <MapPin aria-hidden="true" /><span>{want.city}</span><span aria-hidden="true">·</span>
        <time dateTime={want.createdAt} title={new Date(want.createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}>{relativeTime(want.createdAt)}</time>
      </div></div>
      <span className={styles.status} data-tone={status.tone}>{status.label}</span>
      {mine ? <WantOwnerActions wantId={want.id} status={want.status} offerCount={want.offerCount} /> : <WantReportMenu wantId={want.id} viewer={want.viewer} />}
    </header>
      <div className={styles.tags}><span className={styles.typeBadge} data-type={want.requestType}><TypeIcon aria-hidden="true" />{WANT_TYPE_LABELS[want.requestType] || "Product"}</span><span className={styles.tag}>{want.category}</span>{want.occasion && <span className={styles.tag}>{want.occasion}</span>}</div>
      <h2 id={`want-${want.id}`} className={styles.title}><Link href={href} onClick={onDetails}>{want.title}</Link></h2>
      {want.description && <><p className={`${styles.description} ${longText && !expanded ? styles.clamped : ""}`}>{want.description}</p>{longText && <button type="button" className={styles.seeMore} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "See less" : "See more"}</button>}</>}
    </div>
    {photo && !photoFailed && <div className={styles.photo}><Image src={photo} alt={`Reference for ${want.title}`} fill sizes="(max-width: 800px) 100vw, 720px" unoptimized onError={() => setPhotoFailed(true)} /></div>}
    <footer className={styles.postFooter}>
      <dl className={styles.facts}>
        {shownBudget && <div><dt>Budget</dt><dd>{shownBudget}</dd></div>}
        <div><dt>Quantity</dt><dd>{want.quantity.toLocaleString("en-PK")}</dd></div>
        <div><dt>Expires</dt><dd><CalendarClock aria-hidden="true" />{new Date(want.expiresAt).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}</dd></div>
        <div className={styles.detailsLink}><Link href={href} onClick={onDetails} className={styles.textLink}>View details <ArrowRight aria-hidden="true" /></Link></div>
      </dl>
      {status.tone === "pending"
        ? <p className={styles.cardHint}>Only visible to you until our team approves it.</p>
        : <WantSocialBar want={want} ownerOffersHref={href} />}
    </footer>
  </article>;
}

export function WantsFeed({ categories }: { categories: string[] }) {
  const search = useSearchParams();
  const { data: session, status: authStatus } = useSession();
  const rawTab = search?.get("tab");
  const tab: WantsFeedTab = rawTab === "trending" || rawTab === "mine" || rawTab === "joined" ? rawTab : "all";
  const rawType = (search?.get("type") || "").toUpperCase();
  const filters: Filters = {
    tab,
    city: (search?.get("city") || "").trim().slice(0, 100),
    category: (search?.get("category") || "").slice(0, 100),
    type: rawType === "PRODUCT" || rawType === "SERVICE" || rawType === "GIFT" ? rawType : "",
    q: (search?.get("q") || "").trim().slice(0, 100),
  };
  const query = queryFor(filters);
  const customerId = session?.user?.role === "customer" ? session.user.id : "";
  const accountTab = tab === "mine" || tab === "joined";
  const [pager] = useState(() => new WantsFeedPager());
  const state = useSyncExternalStore(pager.subscribe, pager.getSnapshot, pager.getSnapshot);
  const loadedKey = useRef("");
  const restoreY = useRef<{ key: string; y: number } | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [cityDraft, setCityDraft] = useState(filters.city), [categoryDraft, setCategoryDraft] = useState(filters.category), [qDraft, setQDraft] = useState(filters.q);
  const needsSignIn = accountTab && authStatus !== "loading" && !customerId;
  const waitingAuth = authStatus === "loading";
  const blocked = needsSignIn || waitingAuth;
  // Viewer-specific fields (reactions, joined, offers) differ per account, so every cache key carries it.
  const viewerKey = session?.user?.id ? `${session.user.role}:${session.user.id}` : "guest";
  const cacheKey = `${viewerKey}:${query}`;
  const selectionPending = loadedKey.current !== cacheKey;
  usePageLoading(waitingAuth || (!blocked && (selectionPending || !state.initialized || state.loading)));

  const selectFeed = useCallback((next: Filters, allowRestore = false) => {
    const nextQuery = queryFor(next);
    const nextKey = `${viewerKey}:${nextQuery}`;
    loadedKey.current = nextKey;
    if ((next.tab === "mine" || next.tab === "joined") && !customerId) { pager.clear(); return Promise.resolve(); }
    const cached = allowRestore ? restore(nextKey) : null;
    restoreY.current = cached ? { key: nextKey, y: cached.scrollY } : null;
    return pager.reset(nextQuery, cached || undefined);
  }, [customerId, pager, viewerKey]);
  const filtersRef = useRef(filters); filtersRef.current = filters;
  useEffect(() => { if (!waitingAuth && loadedKey.current !== cacheKey) void selectFeed(filtersRef.current, true); }, [cacheKey, selectFeed, waitingAuth]);
  useEffect(() => { setCityDraft(filters.city); setCategoryDraft(filters.category); setQDraft(filters.q); }, [filters.city, filters.category, filters.q]);
  useEffect(() => () => {
    // Development StrictMode remounts effects; an aborted first load must restart.
    if (pager.getSnapshot().loading) loadedKey.current = "";
    pager.dispose();
  }, [pager]);
  useLayoutEffect(() => {
    if (restoreY.current === null || restoreY.current.key !== loadedKey.current || !state.initialized || state.loading) return;
    const target = restoreY.current; restoreY.current = null;
    let restored = false;
    const frame = requestAnimationFrame(() => {
      restored = true;
      if (loadedKey.current === target.key) window.scrollTo({ top: target.y, behavior: "instant" as ScrollBehavior });
    });
    return () => { cancelAnimationFrame(frame); if (!restored && loadedKey.current === target.key) restoreY.current = target; };
  }, [state]);
  useEffect(() => {
    const refresh = () => { memory.delete(cacheKey); try { sessionStorage.removeItem(storagePrefix + cacheKey); } catch {} if (tab === "mine") void selectFeed(filtersRef.current); };
    window.addEventListener("wants-changed", refresh); return () => window.removeEventListener("wants-changed", refresh);
  }, [cacheKey, selectFeed, tab]);
  useEffect(() => {
    const removed = (event: Event) => {
      const { id, closed } = (event as CustomEvent<{ id: string; closed: boolean }>).detail || {};
      pager.mapItems(items => closed && tab === "mine" ? items.map(item => item.id === id ? { ...item, status: "CLOSED" } : item) : items.filter(item => item.id !== id));
      memory.clear(); try { Object.keys(sessionStorage).filter(key => key.startsWith(storagePrefix)).forEach(key => sessionStorage.removeItem(key)); } catch {}
    };
    window.addEventListener("want-deleted", removed); return () => window.removeEventListener("want-deleted", removed);
  }, [pager, tab]);
  useEffect(() => {
    if (!sentinel.current || blocked || !state.initialized || state.loading || state.loadingMore || state.error || state.moreError || !state.hasMore) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void pager.loadMore(); }, { rootMargin: "0px 0px 500px 0px" });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [blocked, pager, state]);

  function changeFilters(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    const nextQuery = queryFor(next);
    if (nextQuery === query) return;
    window.history.pushState(null, "", `/wants?${nextQuery}`);
    return selectFeed(next);
  }
  function rememberPosition() {
    const snapshot = pager.getSnapshot(); if (!snapshot.initialized || snapshot.error) return;
    const cached: CachedFeed = { items: snapshot.items, nextCursor: snapshot.nextCursor, hasMore: snapshot.hasMore, scrollY: window.scrollY, savedAt: Date.now(), resume: true };
    memory.set(cacheKey, cached); if (memory.size > 5) memory.delete(memory.keys().next().value!);
    try { sessionStorage.setItem(storagePrefix + cacheKey, JSON.stringify(cached)); } catch { /* Memory cache still restores when storage is unavailable. */ }
  }
  const feedHref = `/wants?${query}`;
  const signInHref = `/login?role=customer&mode=signin&callbackUrl=${encodeURIComponent(feedHref)}`;
  const scopeLabel = tab === "mine" ? "Your posts, including pending Wants"
    : tab === "joined" ? "Requests you joined"
    : [filters.type ? `${WANT_TYPE_LABELS[filters.type]} requests` : "Wants", filters.city ? `in ${filters.city}` : "from across Pakistan", filters.q ? `matching “${filters.q}”` : ""].filter(Boolean).join(" ");
  const emptyTitle = tab === "mine" ? "You haven't posted a Want yet" : tab === "joined" ? "You haven't joined any requests yet" : "No Wants match just yet";
  const emptyText = tab === "mine" ? "Post what you need. Your submission will appear here while it is reviewed."
    : tab === "joined" ? "Join a request when you need the same thing — sellers see the demand grow."
    : "Try another city, type or search, or let the community know what you're looking for.";

  return <div className={styles.page}><div className={styles.container}>
    <header className={styles.heading}><div><p className={styles.eyebrow}><MessageSquareText aria-hidden="true" /> The JORO community</p><h1>Wants</h1><p className={styles.intro}>Real requests from real people. Join a request you share, or send a private offer as a seller.</p></div><PostWantButton className={styles.primary}><Plus aria-hidden="true" /> Post a Want</PostWantButton></header>
    <section className={styles.filters} aria-label="Filter Wants">
      <nav className={styles.tabs} aria-label="Wants feeds">{TABS.map(({ id, label, Icon }) => <LoadingButton key={id} type="button" className={styles.tab} aria-pressed={tab === id} loadingLabel="Loading…" onClick={() => changeFilters({ tab: id })}><Icon aria-hidden="true" />{label}</LoadingButton>)}</nav>
      <div className={styles.typeRow} role="group" aria-label="Request type">{TYPES.map(({ id, label, Icon }) => <LoadingButton key={label} type="button" className={styles.chip} aria-pressed={filters.type === id} loadingLabel="Loading…" onClick={() => changeFilters({ type: id })}><Icon aria-hidden="true" />{label}</LoadingButton>)}</div>
      <LoadingForm className={styles.filterForm} onSubmit={event => { event.preventDefault(); return changeFilters({ city: cityDraft, category: categoryDraft, q: qDraft }); }}>
        <label className={`${styles.field} ${styles.searchField}`}><span>Search</span><div className={styles.inputIcon}><Search aria-hidden="true" /><input type="search" placeholder="Search requests" aria-label="Search Wants" value={qDraft} maxLength={100} onChange={event => setQDraft(event.target.value)} /></div></label>
        <label className={styles.field}><span>City</span><input list="wants-city-options" placeholder="All cities" aria-label="Filter by city" value={cityDraft} maxLength={100} onChange={event => setCityDraft(event.target.value)} /></label>
        <datalist id="wants-city-options">{cities.map(name => <option key={name} value={name} />)}</datalist>
        <label className={styles.field}><span>Category</span><select value={categoryDraft} onChange={event => setCategoryDraft(event.target.value)}><option value="">All categories</option>{categories.map(name => <option key={name} value={name}>{name}</option>)}{filters.category && !categories.includes(filters.category) && <option value={filters.category}>{filters.category}</option>}</select></label>
        <LoadingButton type="submit" className={styles.secondary} loadingLabel="Filtering…"><ListFilter aria-hidden="true" /> Apply</LoadingButton>
      </LoadingForm>
    </section>
    <div className={styles.feedLabel}><span>{scopeLabel}</span><span>{tab === "trending" ? "Most demand first" : "Newest first"}</span></div>
    {needsSignIn ? <div className={styles.notice}><div className={styles.noticeIcon}><UserRound /></div><h2>{tab === "mine" ? "Your Wants, all in one place" : "Requests you've joined"}</h2><p>Sign in with your customer account to see {tab === "mine" ? "your posts and their review status" : "the requests you joined"}.</p><Link href={signInHref} className={styles.primary}>Sign in <ArrowRight aria-hidden="true" /></Link></div>
      : state.error && !selectionPending ? <div className={styles.notice}><p role="alert" className={styles.error}>{state.error}</p><LoadingButton className={styles.primary} loadingLabel="Retrying…" onClick={pager.retry}><RotateCcw aria-hidden="true" /> Try again</LoadingButton></div>
      : waitingAuth || selectionPending || !state.initialized || state.loading ? <WantsFeedSkeleton />
      : <>
        <div className={styles.list}>{state.items.map(want => <FeedPost key={want.id} want={want} href={`/wants/${want.id}?from=${encodeURIComponent(feedHref)}`} onDetails={rememberPosition} mine={tab === "mine"} />)}</div>
        {!state.items.length && <div className={styles.notice}><div className={styles.noticeIcon}><MessageSquareText /></div><h2>{emptyTitle}</h2><p>{emptyText}</p>{tab === "joined" ? <LoadingButton type="button" className={styles.primary} onClick={() => changeFilters({ tab: "all" })}>Browse Wants</LoadingButton> : <PostWantButton className={styles.primary}><Plus aria-hidden="true" /> Post a Want</PostWantButton>}</div>}
        {state.loadingMore && <div className="mt-5"><WantsFeedSkeleton more /></div>}
        {state.moreError && <div className={`${styles.notice} mt-5`}><p role="alert" className={styles.error}>{state.moreError}</p><LoadingButton className={styles.secondary} loadingLabel="Retrying…" onClick={pager.retry}><RotateCcw aria-hidden="true" /> Retry loading more</LoadingButton></div>}
        {state.hasMore && !state.moreError && <><div ref={sentinel} className={styles.sentinel} aria-hidden="true" /><div className={styles.more}><LoadingButton type="button" className={styles.secondary} loading={state.loadingMore} loadingLabel="Loading…" onClick={pager.loadMore}>Load more Wants</LoadingButton></div></>}
        {!state.hasMore && state.items.length > 0 && <p className={styles.end} role="status"><CheckCircle2 aria-hidden="true" /> You’re all caught up</p>}
      </>}
  </div></div>;
}
