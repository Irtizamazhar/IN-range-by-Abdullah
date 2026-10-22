"use client";
import Image from "next/image";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import toast from "react-hot-toast";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/LoadingLink";
import {
  Banknote, Bell, Check, CircleX, ClipboardList, CreditCard, Heart, Mail, Megaphone, MessageSquareMore,
  MoreVertical, Package, PackageCheck, PackageX, RotateCcw, Scale, Search, Settings, Sparkles, Tag, Truck,
  type LucideIcon,
} from "lucide-react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { safeAccountLink } from "@/lib/customer-account-policy";
import {
  notificationActionLabel, notificationCategory, notificationSearchText, notificationVisual,
  type NotificationCategory, type NotificationVisual,
} from "@/lib/customer-notification-display";

type Row = { id: string; type: string; title: string; message: string; link: string | null; isRead: boolean; createdAt: string; image: string | null };
type Filter = "all" | NotificationCategory | "unread" | "read";

/** Lets the header bell refresh its unread badge immediately after read-state changes. */
const NOTIFICATIONS_CHANGED = "joro:notifications-changed";

const categoryFilters: { id: Filter; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All Notifications", icon: Bell },
  { id: "wants", label: "Wants", icon: Heart },
  { id: "offers", label: "Offers", icon: Tag },
  { id: "orders", label: "Orders", icon: Package },
  { id: "messages", label: "Messages", icon: MessageSquareMore },
  { id: "system", label: "System", icon: Settings },
];
const stateFilters: { id: Filter; label: string; icon: LucideIcon }[] = [
  { id: "unread", label: "Unread", icon: Mail },
  { id: "read", label: "Read", icon: Check },
];

const visuals: Record<NotificationVisual, { icon: LucideIcon; tone: string }> = {
  "want-live": { icon: Megaphone, tone: "bg-[#E9F8EC] text-[#1E9E45]" },
  "want-rejected": { icon: CircleX, tone: "bg-[#FFF4E5] text-[#F59E0B]" },
  "want-update": { icon: ClipboardList, tone: "bg-[#EEF2F7] text-[#475569]" },
  offer: { icon: Tag, tone: "bg-[#FDECEC] text-[#EF4444]" },
  "offer-withdrawn": { icon: Tag, tone: "bg-[#F1F3F5] text-[#94A3B8]" },
  order: { icon: Package, tone: "bg-[#EAF3FF] text-[#2F80ED]" },
  "order-shipped": { icon: Package, tone: "bg-[#EAF3FF] text-[#2F80ED]" },
  "order-delivered": { icon: PackageCheck, tone: "bg-[#E9F8EC] text-[#1E9E45]" },
  "order-cancelled": { icon: PackageX, tone: "bg-[#FDECEC] text-[#EF4444]" },
  "seller-delivery": { icon: Truck, tone: "bg-[#EAF3FF] text-[#2F80ED]" },
  payment: { icon: CreditCard, tone: "bg-[#EEF0FF] text-[#5B5BD6]" },
  return: { icon: RotateCcw, tone: "bg-[#FFF4E5] text-[#F59E0B]" },
  refund: { icon: Banknote, tone: "bg-[#E6F7F3] text-[#0F9F7F]" },
  dispute: { icon: Scale, tone: "bg-[#F4ECFF] text-[#8B5CF6]" },
  message: { icon: MessageSquareMore, tone: "bg-[#F4ECFF] text-[#8B5CF6]" },
  welcome: { icon: Sparkles, tone: "bg-[#E9F8EC] text-[#1E9E45]" },
  system: { icon: Bell, tone: "bg-[#EEF2F7] text-[#475569]" },
};
/** Icons whose outline reads poorly when filled; they are drawn as strokes instead. */
const outlineOnly = new Set<NotificationVisual>(["want-update", "seller-delivery", "payment", "return", "refund", "dispute", "welcome", "system"]);

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const fullDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const timeOf = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function groupByDay(rows: Row[]) {
  const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const groups: { key: string; label: string; date: string | null; rows: Row[] }[] = [];
  for (const row of rows) {
    const created = new Date(row.createdAt); const key = dayKey(created);
    let group = groups.find(g => g.key === key);
    if (!group) {
      const label = key === dayKey(today) ? "Today" : key === dayKey(yesterday) ? "Yesterday" : fullDate(created);
      group = { key, label, date: label === "Today" || label === "Yesterday" ? fullDate(created) : null, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

function Thumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <span className="relative hidden h-[62px] w-[62px] shrink-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:block">
    <Image src={src} alt="" fill sizes="62px" unoptimized className="object-cover" onError={() => setFailed(true)} />
  </span>;
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) close(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", onPointer); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

const menuItem = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#0F172A] hover:bg-[#F3F7EE] focus-visible:bg-[#F3F7EE] focus-visible:outline-none";

function RowMenu({ row, action, onMark, onOpen }: { row: Row; action: string | null; onMark: () => Promise<void>; onOpen: () => void }) {
  const [open, setOpen] = useState(false); const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  if (!action && row.isRead) return <span className="w-9 shrink-0" aria-hidden="true" />;
  return <div ref={ref} className="relative z-10 shrink-0">
    <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`More actions for ${row.title}`} onClick={() => setOpen(v => !v)}
      className="flex h-9 w-9 items-center justify-center rounded-full text-[#334155] hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link">
      <MoreVertical className="h-5 w-5" aria-hidden="true" />
    </button>
    {open && <div role="menu" className="absolute right-0 top-10 w-48 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
      {action && <button type="button" role="menuitem" className={menuItem} onClick={() => { close(); onOpen(); }}>{action}</button>}
      {!row.isRead && <button type="button" role="menuitem" className={menuItem} onClick={() => { close(); void onMark(); }}><Check className="h-4 w-4" aria-hidden="true" />Mark as read</button>}
    </div>}
  </div>;
}

function SettingsMenu() {
  const [open, setOpen] = useState(false); const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return <div ref={ref} className="relative">
    <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Notification settings" onClick={() => setOpen(v => !v)}
      className="flex h-[50px] w-[56px] items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-[#F8FAF5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link">
      <Settings className="h-5 w-5" aria-hidden="true" />
    </button>
    {open && <div role="menu" className="absolute right-0 top-14 z-20 w-56 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
      <Link role="menuitem" href="/marketing/preferences" className={menuItem} onClick={close}>Email preferences</Link>
      <Link role="menuitem" href="/account?tab=profile" className={menuItem} onClick={close}>Account settings</Link>
    </div>}
  </div>;
}

function FilterButton({ item, count, active, tone, onSelect, compact }: { item: { id: Filter; label: string; icon: LucideIcon }; count: number | null; active: boolean; tone: "default" | "alert"; onSelect: () => void; compact?: boolean }) {
  const Icon = item.icon;
  const badge = count === null ? null : <span className={`flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-2 text-[13px] font-semibold ${active ? "bg-[#0B5A2E] text-white" : tone === "alert" ? "bg-[#FDECEC] text-[#DC2626]" : "border border-[#E5E7EB] bg-[#F8FAFC] text-[#0F172A]"}`}>{count}</span>;
  if (compact) return <button type="button" aria-pressed={active} onClick={onSelect}
    className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link ${active ? "border-[#CFEBC0] bg-[#EAF7E2] text-[#0F172A]" : "border-[#E5E7EB] bg-white text-[#334155]"}`}>
    <Icon className="h-4 w-4" aria-hidden="true" />{item.label}{badge}
  </button>;
  return <button type="button" aria-pressed={active} onClick={onSelect}
    className={`flex h-[54px] w-full items-center gap-3.5 rounded-xl px-4 text-left text-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link ${active ? "bg-[#EAF7E2] font-semibold text-[#0F172A]" : "font-medium text-[#1E293B] hover:bg-[#F6F9F2]"}`}>
    <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.8} aria-hidden="true" /><span className="flex-1 whitespace-nowrap">{item.label}</span>{badge}
  </button>;
}

export default function NotificationsPage() {
  const { data: session, status } = useSession(); const { openAuthModal } = useCustomerAuth(); const router = useRouter();
  const customerId = session?.user?.role === "customer" ? session.user.id : "";
  const [rows,setRows] = useState<Row[]>([]); const [ownerId,setOwnerId] = useState(""); const [unread,setUnread] = useState(0); const [message,setMessage] = useState(""); const [loading,setLoading] = useState(true);
  const [filter,setFilter] = useState<Filter>("all"); const [query,setQuery] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => { if (!customerId) return; setLoading(true); try { const r = await fetch("/api/customer/notifications",{ signal }); const d = await r.json(); if (!r.ok) throw new Error(d.error); if (!signal?.aborted) { setRows(d.notifications); setUnread(d.unread); setOwnerId(customerId); setMessage(""); } } catch(e) { if (!signal?.aborted) setMessage(e instanceof Error ? e.message : "Could not load notifications."); } finally { if (!signal?.aborted) setLoading(false); } },[customerId]);
  useEffect(() => { setRows([]); const c = new AbortController(); void load(c.signal); return () => c.abort(); },[load]);
  async function mark(id?: string) { try { const r = await fetch(`/api/customer/notifications${id ? `/${id}` : ""}`,{method:"PATCH"}); const d = await r.json(); if (!r.ok) throw new Error(d.error); window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)); await load(); toast.success(id ? "Notification marked as read." : "All notifications marked as read."); } catch(e) { setMessage(e instanceof Error ? e.message : "Could not mark notification read."); } }
  function open(row: Row) {
    const href = safeAccountLink(row.link); if (!href) return;
    if (!row.isRead) { void fetch(`/api/customer/notifications/${row.id}`, { method: "PATCH", keepalive: true }).then(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))).catch(() => undefined); }
    router.push(href);
  }

  const current = useMemo(() => ownerId === customerId ? rows : [], [ownerId, customerId, rows]);
  const currentUnread = ownerId === customerId ? unread : 0;
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: current.length, wants: 0, offers: 0, orders: 0, messages: 0, system: 0, unread: currentUnread, read: 0 };
    for (const row of current) { c[notificationCategory(row)] += 1; if (row.isRead) c.read += 1; }
    return c;
  }, [current, currentUnread]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return current.filter(row => (filter === "all" || (filter === "unread" ? !row.isRead : filter === "read" ? row.isRead : notificationCategory(row) === filter)) && (!q || notificationSearchText(row).includes(q)));
  }, [current, filter, query]);
  const groups = useMemo(() => groupByDay(visible), [visible]);
  const newestUnread = current.find(row => !row.isRead)?.id;

  if (status === "loading") return <PageSkeleton label="Loading notifications…" />;
  if (!customerId) return <main className="p-8"><h1 className="text-3xl font-bold">Notifications</h1><LoadingButton onClick={() => openAuthModal("login")} className="mt-4 rounded-xl bg-brand-primary p-3">Sign in</LoadingButton></main>;

  const allFilters = [...categoryFilters, ...stateFilters];
  const activeLabel = allFilters.find(f => f.id === filter)?.label ?? "All Notifications";
  return <main className="min-h-dvh bg-[#F5F6F4] px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
    <div className="mx-auto max-w-[1480px] rounded-[22px] border border-[#ECEEEA] bg-white px-4 py-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)] sm:px-6 sm:py-7 lg:px-9 lg:py-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-[#0B1220] sm:text-[40px]">Notifications</h1>
          <p className="mt-1.5 text-[15px] text-[#475569] sm:text-[17px]">Stay updated with your activity on JORO.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:flex-nowrap lg:gap-4">
          <label className="relative order-1 w-full sm:order-none sm:w-auto sm:flex-1 lg:w-[340px] lg:flex-none">
            <span className="sr-only">Search notifications</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#334155]" aria-hidden="true" />
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search notifications..."
              className="h-[50px] w-full rounded-xl border border-[#E2E8F0] bg-white pl-12 pr-4 text-[15px] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#7CB342] focus:outline-none focus:ring-2 focus:ring-[#B9E28C]" />
          </label>
          <div className="order-2 flex flex-1 items-center gap-3 sm:order-none sm:flex-none lg:gap-4">
            <SettingsMenu />
            <LoadingButton onClick={() => mark()} disabled={!currentUnread}
              className="flex h-[50px] flex-1 items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-[#0B5A2E] px-6 text-[15px] font-semibold text-white shadow-[0_4px_12px_rgba(11,90,46,0.22)] hover:bg-[#094A26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B5A2E] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none">
              <Check className="h-5 w-5" aria-hidden="true" />Mark all as read
            </LoadingButton>
          </div>
        </div>
      </header>

      <div className="mt-7 grid gap-6 md:grid-cols-[250px_minmax(0,1fr)] lg:mt-9 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Notification filters" className="-mx-4 overflow-x-auto px-4 pb-1 md:hidden">
          <div className="flex gap-2">{allFilters.map(item => <FilterButton key={item.id} compact item={item} count={item.id === "read" ? null : counts[item.id]} active={filter === item.id} tone={item.id === "unread" ? "alert" : "default"} onSelect={() => setFilter(item.id)} />)}</div>
        </nav>
        <aside aria-label="Notification filters" className="hidden self-start rounded-2xl border border-[#F0F2EE] bg-white p-2.5 md:block">
          <div className="space-y-2.5">{categoryFilters.map(item => <FilterButton key={item.id} item={item} count={counts[item.id]} active={filter === item.id} tone="default" onSelect={() => setFilter(item.id)} />)}</div>
          <hr className="mx-2 my-5 border-[#E5E7EB]" />
          <div className="space-y-1.5 pb-2">{stateFilters.map(item => <FilterButton key={item.id} item={item} count={item.id === "unread" ? counts.unread : null} active={filter === item.id} tone="alert" onSelect={() => setFilter(item.id)} />)}</div>
        </aside>

        <section aria-label={activeLabel} className="min-w-0">
          <p className="sr-only" role="status">{message || (loading ? "Loading notifications…" : `${currentUnread} unread`)}</p>
          {message && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]"><span>{message}</span><LoadingButton onClick={() => load()} className="font-semibold underline">Try again</LoadingButton></div>}
          {loading && !current.length && !message && <PageSkeleton label="Loading notifications…" variant="cards" rows={4} />}
          {groups.map(group => <div key={group.key} className="mb-6 last:mb-0">
            <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
              <h2 className="flex items-center gap-3 text-[20px] font-bold text-[#0B1220] sm:text-[22px]">{group.label}<span className="flex h-[26px] min-w-[32px] items-center justify-center rounded-full bg-[#F1F3F5] px-2 text-[13px] font-semibold text-[#334155]">{group.rows.length}</span></h2>
              {group.date && <span className="text-[14px] text-[#64748B] sm:text-[16px]">{group.date}</span>}
            </div>
            <ul className="space-y-2.5">{group.rows.map(row => {
              const visual = notificationVisual(row); const { icon: Icon, tone } = visuals[visual];
              const href = safeAccountLink(row.link); const action = href ? notificationActionLabel(row) : null;
              const highlighted = row.id === newestUnread;
              return <li key={row.id} className={`relative flex items-center gap-3 rounded-xl border px-3 py-3 transition-shadow hover:shadow-[0_4px_14px_rgba(15,23,42,0.06)] sm:gap-4 sm:px-4 sm:py-3.5 ${highlighted ? "border-[#B9E28C] bg-[#F1FAEA]" : "border-[#E5E7EB] bg-white"}`}>
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-[62px] sm:w-[62px] ${tone}`}>
                  {outlineOnly.has(visual) ? <Icon className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={2} aria-hidden="true" /> : <Icon className="h-6 w-6 sm:h-8 sm:w-8" fill="currentColor" stroke="white" strokeWidth={1.6} aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] font-bold leading-snug text-[#0B1220] sm:text-[17px]">
                    {href ? <button type="button" onClick={() => open(row)} className="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-brand-link">{row.title}</button> : row.title}
                    {highlighted && <span className="rounded-full bg-[#D9F2C7] px-2 py-0.5 text-[11px] font-bold text-[#1F6B22]">New</span>}
                  </h3>
                  <p className="mt-1 break-words text-[13.5px] leading-snug text-[#475569] sm:text-[15px]">{row.message}</p>
                  <p className="mt-1.5 text-[12px] text-[#64748B] sm:text-[12.5px]"><time dateTime={row.createdAt}>{timeOf(new Date(row.createdAt))}</time>{!row.isRead && <span className="sr-only"> · Unread</span>}</p>
                </div>
                {row.image && <Thumbnail src={row.image} />}
                <span className="flex w-3 shrink-0 justify-center sm:w-5">{!row.isRead && <span className="h-2.5 w-2.5 rounded-full bg-[#22A447]" aria-hidden="true" />}</span>
                <RowMenu row={row} action={action} onMark={() => mark(row.id)} onOpen={() => open(row)} />
              </li>;
            })}</ul>
          </div>)}
          {!loading && !message && !visible.length && <div className="rounded-2xl border border-dashed border-[#D9DED5] bg-[#FAFBF9] px-6 py-14 text-center">
            <Bell className="mx-auto h-8 w-8 text-[#94A3B8]" aria-hidden="true" />
            <p className="mt-3 font-semibold text-[#0F172A]">{!current.length ? "No notifications yet" : query.trim() ? "No notifications match your search" : `No ${activeLabel.toLowerCase()} notifications`}</p>
            <p className="mt-1 text-sm text-[#64748B]">{!current.length ? "Real account updates will appear here." : "Try another filter or search term."}</p>
          </div>}
        </section>
      </div>
    </div>
  </main>;
}
