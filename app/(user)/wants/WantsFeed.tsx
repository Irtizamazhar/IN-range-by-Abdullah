"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, CheckCircle2, ListFilter, MapPin, MessageSquareText, Navigation, Plus, RotateCcw, UserRound, UsersRound } from "lucide-react";
import Link from "@/components/ui/LoadingLink";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { PostWantButton } from "@/components/user/PostWantButton";
import { usePageLoading } from "@/hooks/usePageLoading";
import { WantsFeedPager, type RestoredFeed } from "@/lib/wants-feed-client";
import type { WantsFeedItem, WantsFeedTab } from "@/lib/wants-feed-types";
import styles from "./WantsFeed.module.css";

type CachedFeed = RestoredFeed & { scrollY: number; savedAt: number; resume: boolean };
const memory = new Map<string, CachedFeed>();
const storagePrefix = "joro-wants-feed-v1:";
const cities = ["Islamabad", "Karachi", "Lahore", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Taxila"];
function queryFor(tab: WantsFeedTab, city: string, category: string) {
  const params = new URLSearchParams({ tab });
  if (city.trim()) params.set("city", city.trim());
  if (category) params.set("category", category);
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
function budget(want: WantsFeedItem) {
  if (want.budgetFlexible) return "Flexible";
  const min = Number(want.budgetMin || 0), max = Number(want.budgetMax || 0);
  const money = (value: number) => `PKR ${value.toLocaleString("en-PK")}`;
  if (min && max && min !== max) return `${money(min)} – ${money(max)}`;
  return max ? `Up to ${money(max)}` : min ? `From ${money(min)}` : "Not specified";
}
function statusFor(want: WantsFeedItem) {
  if (["PENDING_MODERATION", "SUBMITTED"].includes(want.status)) return { label: "Pending review", tone: "pending" };
  if (want.status === "OPEN" && new Date(want.expiresAt).getTime() > Date.now()) return { label: "Open", tone: "open" };
  if (want.status === "OPEN") return { label: "Expired", tone: "closed" };
  return { label: want.status.charAt(0) + want.status.slice(1).toLowerCase().replaceAll("_", " "), tone: "closed" };
}

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

function FeedPost({ want, href, onDetails }: { want: WantsFeedItem; href: string; onDetails: () => void }) {
  const status = statusFor(want);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = want.images[0] || want.photo;
  const initials = want.customer.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  return <article className={styles.card} data-want-post={want.id} aria-labelledby={`want-${want.id}`}>
    <div className={styles.cardBody}><header className={styles.postHeader}>
      <div className={styles.avatar}>{want.customer.image && !avatarFailed ? <Image src={want.customer.image} alt="" width={43} height={43} unoptimized onError={() => setAvatarFailed(true)} /> : <span aria-hidden="true">{initials || "J"}</span>}</div>
      <div className={styles.author}><strong>{want.customer.name}</strong><div className={styles.meta}><MapPin aria-hidden="true" /><span>{want.city}</span><span aria-hidden="true">·</span><time dateTime={want.createdAt}>{new Date(want.createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</time></div></div>
      <span className={styles.status} data-tone={status.tone}>{status.label}</span>
    </header><h2 id={`want-${want.id}`} className={styles.title}>{want.title}</h2>{want.description && <p className={styles.description}>{want.description}</p>}</div>
    {photo && !photoFailed && <div className={styles.photo}><Image src={photo} alt={`Reference for ${want.title}`} fill sizes="(max-width: 800px) 100vw, 780px" onError={() => setPhotoFailed(true)} /></div>}
    <footer className={styles.postFooter}><dl className={styles.facts}><div><dt>Budget</dt><dd>{budget(want)}</dd></div><div><dt>Quantity</dt><dd>{want.quantity.toLocaleString("en-PK")}</dd></div><div><dt>Category</dt><dd>{want.category}</dd></div></dl>
      <div className={styles.cardActions}><span className={styles.cardHint}>{status.tone === "pending" ? "Only visible to you until approved" : "A real need. A new possibility."}</span><Link href={href} onClick={onDetails} className={styles.secondary}>View details <ArrowRight aria-hidden="true" /></Link></div>
    </footer>
  </article>;
}

export function WantsFeed({ categories }: { categories: string[] }) {
  const search = useSearchParams();
  const { data: session, status: authStatus } = useSession();
  const rawTab = search?.get("tab");
  const tab: WantsFeedTab = rawTab === "nearby" || rawTab === "mine" ? rawTab : "all";
  const city = (search?.get("city") || "").trim().slice(0, 100), category = (search?.get("category") || "").slice(0, 100);
  const query = queryFor(tab, city, category);
  const customerId = session?.user?.role === "customer" ? session.user.id : "";
  const [pager] = useState(() => new WantsFeedPager());
  const state = useSyncExternalStore(pager.subscribe, pager.getSnapshot, pager.getSnapshot);
  const loadedKey = useRef("");
  const restoreY = useRef<{ key: string; y: number } | null>(null);
  const sentinel = useRef<HTMLDivElement>(null), cityInput = useRef<HTMLInputElement>(null);
  const [cityDraft, setCityDraft] = useState(city), [categoryDraft, setCategoryDraft] = useState(category);
  const needsSignIn = tab === "mine" && authStatus !== "loading" && !customerId;
  const needsCity = tab === "nearby" && !city;
  const waitingAuth = tab === "mine" && authStatus === "loading";
  const blocked = needsSignIn || needsCity || waitingAuth;
  const cacheKey = `${tab === "mine" ? customerId : "public"}:${query}`;
  const selectionPending = loadedKey.current !== cacheKey;
  usePageLoading(waitingAuth || (!blocked && (selectionPending || !state.initialized || state.loading)));

  const selectFeed = useCallback((nextTab: WantsFeedTab, nextCity: string, nextCategory: string, allowRestore = false) => {
    const nextQuery = queryFor(nextTab, nextCity, nextCategory);
    const nextKey = `${nextTab === "mine" ? customerId : "public"}:${nextQuery}`;
    loadedKey.current = nextKey;
    if ((nextTab === "mine" && !customerId) || (nextTab === "nearby" && !nextCity.trim())) { pager.clear(); return Promise.resolve(); }
    const cached = allowRestore ? restore(nextKey) : null;
    restoreY.current = cached ? { key: nextKey, y: cached.scrollY } : null;
    return pager.reset(nextQuery, cached || undefined);
  }, [customerId, pager]);
  useEffect(() => { if (!waitingAuth && loadedKey.current !== cacheKey) void selectFeed(tab, city, category, true); }, [cacheKey, category, city, selectFeed, tab, waitingAuth]);
  useEffect(() => { setCityDraft(city); setCategoryDraft(category); }, [city, category]);
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
    const refresh = () => { memory.delete(cacheKey); try { sessionStorage.removeItem(storagePrefix + cacheKey); } catch {} if (tab === "mine") void selectFeed(tab, city, category); };
    window.addEventListener("wants-changed", refresh); return () => window.removeEventListener("wants-changed", refresh);
  }, [cacheKey, category, city, selectFeed, tab]);
  useEffect(() => {
    if (!sentinel.current || blocked || !state.initialized || state.loading || state.loadingMore || state.error || state.moreError || !state.hasMore) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void pager.loadMore(); }, { rootMargin: "0px 0px 500px 0px" });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [blocked, pager, state]);

  function changeFilters(nextTab: WantsFeedTab, nextCity = city, nextCategory = category) {
    const nextQuery = queryFor(nextTab, nextCity, nextCategory);
    if (nextQuery === query) return;
    window.history.pushState(null, "", `/wants?${nextQuery}`);
    if (nextTab === "nearby" && !nextCity) cityInput.current?.focus();
    return selectFeed(nextTab, nextCity, nextCategory);
  }
  function rememberPosition() {
    const snapshot = pager.getSnapshot(); if (!snapshot.initialized || snapshot.error) return;
    const cached: CachedFeed = { items: snapshot.items, nextCursor: snapshot.nextCursor, hasMore: snapshot.hasMore, scrollY: window.scrollY, savedAt: Date.now(), resume: true };
    memory.set(cacheKey, cached); if (memory.size > 5) memory.delete(memory.keys().next().value!);
    try { sessionStorage.setItem(storagePrefix + cacheKey, JSON.stringify(cached)); } catch { /* Memory cache still restores when storage is unavailable. */ }
  }
  const feedHref = `/wants?${query}`;
  const signInHref = `/login?role=customer&mode=signin&callbackUrl=${encodeURIComponent(feedHref)}`;

  return <div className={styles.page}><div className={styles.container}>
    <header className={styles.heading}><div><p className={styles.eyebrow}><MessageSquareText aria-hidden="true" /> The JORO community</p><h1>Discover what people need</h1><p className={styles.intro}>Real needs. Local people. Find your next connection.</p></div><PostWantButton className={styles.primary}><Plus aria-hidden="true" /> Post a Want</PostWantButton></header>
    <section className={styles.filters} aria-label="Filter Wants">
      <nav className={styles.tabs} aria-label="Wants feeds">{([{ id: "all", label: "All Wants", Icon: UsersRound }, { id: "nearby", label: "Nearby", Icon: Navigation }, { id: "mine", label: "My Wants", Icon: UserRound }] as const).map(({ id, label, Icon }) => <LoadingButton key={id} type="button" className={styles.tab} aria-pressed={tab === id} loadingLabel="Loading…" onClick={() => changeFilters(id)}><Icon aria-hidden="true" />{label}</LoadingButton>)}</nav>
      <LoadingForm className={styles.filterForm} onSubmit={event => { event.preventDefault(); return changeFilters(tab, cityDraft, categoryDraft); }}>
        <label className={styles.field}><span>{tab === "nearby" ? "Your city" : "City"}</span><input ref={cityInput} list="wants-city-options" placeholder="All cities" aria-label="Filter by city" value={cityDraft} maxLength={100} onChange={event => setCityDraft(event.target.value)} required={tab === "nearby"} /></label>
        <datalist id="wants-city-options">{cities.map(name => <option key={name} value={name} />)}</datalist>
        <label className={styles.field}><span>Category</span><select value={categoryDraft} onChange={event => setCategoryDraft(event.target.value)}><option value="">All categories</option>{categories.map(name => <option key={name} value={name}>{name}</option>)}{category && !categories.includes(category) && <option value={category}>{category}</option>}</select></label>
        <LoadingButton type="submit" className={styles.secondary} loadingLabel="Filtering…"><ListFilter aria-hidden="true" /> Apply filters</LoadingButton>
      </LoadingForm>
    </section>
    <div className={styles.feedLabel}><span>{tab === "mine" ? "Your posts, including pending Wants" : city ? `Wants in ${city}` : "Wants from across Pakistan"}</span><span>Newest first</span></div>
    {needsSignIn ? <div className={styles.notice}><div className={styles.noticeIcon}><UserRound /></div><h2>Your Wants, all in one place</h2><p>Sign in with your customer account to see your posts and their review status.</p><Link href={signInHref} className={styles.primary}>Sign in to view My Wants <ArrowRight aria-hidden="true" /></Link></div>
      : needsCity ? <div className={styles.notice}><div className={styles.noticeIcon}><MapPin /></div><h2>Find needs close to you</h2><p>Choose your city above and apply the filter to browse nearby Wants.</p><LoadingButton type="button" className={styles.secondary} onClick={() => cityInput.current?.focus()}>Choose a city</LoadingButton></div>
      : state.error && !selectionPending ? <div className={styles.notice}><p role="alert" className={styles.error}>{state.error}</p><LoadingButton className={styles.primary} loadingLabel="Retrying…" onClick={pager.retry}><RotateCcw aria-hidden="true" /> Try again</LoadingButton></div>
      : waitingAuth || selectionPending || !state.initialized || state.loading ? <WantsFeedSkeleton />
      : <>
        <div className={styles.list}>{state.items.map(want => <FeedPost key={want.id} want={want} href={`/wants/${want.id}?from=${encodeURIComponent(feedHref)}`} onDetails={rememberPosition} />)}</div>
        {!state.items.length && <div className={styles.notice}><div className={styles.noticeIcon}><MessageSquareText /></div><h2>{tab === "mine" ? "You haven't posted a Want yet" : "No Wants match just yet"}</h2><p>{tab === "mine" ? "Post what you need. Your submission will appear here while it is reviewed." : "Try another city or category, or let the community know what you're looking for."}</p><PostWantButton className={styles.primary}><Plus aria-hidden="true" /> Post a Want</PostWantButton></div>}
        {state.loadingMore && <div className="mt-5"><WantsFeedSkeleton more /></div>}
        {state.moreError && <div className={`${styles.notice} mt-5`}><p role="alert" className={styles.error}>{state.moreError}</p><LoadingButton className={styles.secondary} loadingLabel="Retrying…" onClick={pager.retry}><RotateCcw aria-hidden="true" /> Retry loading more</LoadingButton></div>}
        {state.hasMore && !state.moreError && <><div ref={sentinel} className={styles.sentinel} aria-hidden="true" /><div className={styles.more}><LoadingButton type="button" className={styles.secondary} loading={state.loadingMore} loadingLabel="Loading…" onClick={pager.loadMore}>Load more Wants</LoadingButton></div></>}
        {!state.hasMore && <p className={styles.end} role="status"><CheckCircle2 aria-hidden="true" /> You’re all caught up</p>}
      </>}
  </div></div>;
}
