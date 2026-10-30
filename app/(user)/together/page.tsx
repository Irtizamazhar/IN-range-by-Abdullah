"use client";
import Image from "next/image";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import Link from "@/components/ui/LoadingLink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import {
  ArrowRight, Archive, ExternalLink, Gift, House, Info, LayoutGrid, Link2, List, MoreVertical, ShieldCheck,
  ShoppingCart, Users, type LucideIcon,
} from "lucide-react";

type Room = {
  id: string; name: string; archived: boolean; createdAt: string; members: { role: string }[];
  _count: { members: number; items: number }; ownerName: string | null; memberPreview: { name: string; image: string | null }[];
};
type Sort = "latest" | "oldest" | "name" | "products";
type View = "grid" | "list";

const features: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Users, title: "Plan together", text: "Plan family, wedding, or new-home shopping." },
  { icon: ShoppingCart, title: "Separate carts", text: "Every member uses their own cart." },
  { icon: ShieldCheck, title: "Own checkout", text: "Each buyer uses their own address & payment." },
];

/** Card icon and tint picked from the room name; rooms have no stored type. */
function roomStyle(name: string): { icon: LucideIcon; tone: string } {
  const n = name.toLowerCase();
  if (/wedding|shaadi|shadi|nikah|mehndi|gift|eid|birthday/.test(n)) return { icon: Gift, tone: "bg-[#E6F6F8] text-[#0E8A9A]" };
  if (/new home|new house|move|moving|shift/.test(n)) return { icon: ShoppingCart, tone: "bg-[#FDF3E1] text-[#B7791F]" };
  if (/family|home|house|ghar/.test(n)) return { icon: House, tone: "bg-[#E8F5E4] text-[#0B5A2E]" };
  return { icon: ShoppingCart, tone: "bg-[#FDF3E1] text-[#B7791F]" };
}

function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? "").join("") || "?"; }

function Avatars({ room }: { room: Room }) {
  const shown = room.memberPreview.slice(0, 3); const extra = room._count.members - shown.length;
  return <div className="flex shrink-0 items-center" aria-label={`${room._count.members} member${room._count.members === 1 ? "" : "s"}`}>
    {shown.map((m, i) => <span key={i} title={m.name} className="relative -ml-2 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8F5E4] text-[11px] font-semibold text-[#0B5A2E] ring-2 ring-white first:ml-0">
      {m.image ? <Image src={m.image} alt="" fill sizes="32px" unoptimized className="object-cover" /> : initials(m.name)}
    </span>)}
    {extra > 0 && <span className="-ml-2 flex h-8 min-w-8 items-center justify-center rounded-full bg-[#F1F3F1] px-1.5 text-xs font-semibold text-[#334155] ring-2 ring-white">+{extra}</span>}
  </div>;
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

const menuItem = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#0F172A] hover:bg-[#F3F7EE] focus-visible:bg-[#F3F7EE] focus-visible:outline-none";

function RoomMenu({ room, owner, onInvite, onArchive }: { room: Room; owner: boolean; onInvite: () => Promise<void>; onArchive: () => Promise<void> }) {
  const [open, setOpen] = useState(false); const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return <div ref={ref} className="relative shrink-0">
    <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`More actions for ${room.name}`} onClick={() => setOpen(v => !v)}
      className="-mr-1.5 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[#334155] hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link">
      <MoreVertical className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
    {open && <div role="menu" className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
      <Link role="menuitem" href={`/together/${room.id}`} className={menuItem} onClick={close}><ExternalLink className="h-4 w-4" aria-hidden="true" />Open room</Link>
      {owner && !room.archived && <button type="button" role="menuitem" className={menuItem} onClick={() => { close(); void onInvite(); }}><Link2 className="h-4 w-4" aria-hidden="true" />Copy invite link</button>}
      {owner && !room.archived && <button type="button" role="menuitem" className={`${menuItem} text-[#B42318]`} onClick={() => { close(); if (window.confirm(`Archive "${room.name}"? Members will no longer be able to add products.`)) void onArchive(); }}><Archive className="h-4 w-4" aria-hidden="true" />Archive room</button>}
    </div>}
  </div>;
}

function HowItWorks() {
  const [open, setOpen] = useState(false); const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return <div ref={ref} className="absolute right-4 top-4 z-10 sm:right-5 sm:top-5">
    <button type="button" aria-expanded={open} aria-controls="together-how" onClick={() => setOpen(v => !v)}
      className="flex items-center gap-2 rounded-xl border border-[#D9E6D5] bg-white px-3.5 py-2 text-sm font-semibold text-[#0B5A2E] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-[#F6FBF3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link">
      <Info className="h-4 w-4" aria-hidden="true" />How it works?
    </button>
    {open && <div id="together-how" className="absolute right-0 top-12 w-[min(20rem,calc(100vw-3rem))] rounded-2xl border border-[#E5E7EB] bg-white p-4 text-sm text-[#334155] shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
      <p className="font-semibold text-[#10231A]">How Shop Together works</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5">
        <li>Create a room and give it a name.</li>
        <li>Copy the invite link and share it. Each link works for 7 days.</li>
        <li>Members add products to the room and discuss them.</li>
        <li>Everyone checks out from their own cart with their own address and payment.</li>
      </ol>
    </div>}
  </div>;
}

export default function TogetherPage() {
  const { isCustomer, openAuthModal } = useCustomerAuth(); const router = useRouter(); const [rooms, setRooms] = useState<Room[]>([]); const [message, setMessage] = useState(""); const [loaded, setLoaded] = useState(false); const [invite, setInvite] = useState("");
  const [sort, setSort] = useState<Sort>("latest"); const [view, setView] = useState<View>("grid");
  const load = useCallback((signal?: AbortSignal) => fetch("/api/together", { signal }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setRooms(d.rooms); setLoaded(true); }).catch(e => { if (!signal?.aborted) setMessage(e.message); }), []);
  useEffect(() => { if (!isCustomer) return; const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [isCustomer, load]);
  // Keeps the site navbar pinned while this page scrolls; removed again when leaving the page.
  useEffect(() => { const root = document.documentElement; root.classList.add("joro-sticky-chrome"); return () => root.classList.remove("joro-sticky-chrome"); }, []);
  async function create(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); if (!isCustomer) { return openAuthModal("login"); } const f = new FormData(e.currentTarget); try { const r = await fetch("/api/together", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.get("name") }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); await router.push(`/together/${d.room.id}`); } catch(e) { setMessage(e instanceof Error ? e.message : "Could not create room."); } }
  async function copyInvite(room: Room) {
    try { const response = await fetch(`/api/together/${room.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invite" }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); const url = `${window.location.origin}${data.invitePath}`; setInvite(url); try { await navigator.clipboard.writeText(url); setMessage("Invite link copied. Expires in 7 days."); } catch { setMessage("Copy the invitation link above. Expires in 7 days."); } } catch (e) { setMessage(e instanceof Error ? e.message : "Could not create invite."); }
  }
  async function archive(room: Room) {
    try { const response = await fetch(`/api/together/${room.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive" }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessage(`"${room.name}" was archived.`); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : "Could not archive room."); }
  }
  const sorted = useMemo(() => [...rooms].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name) : sort === "products" ? b._count.items - a._count.items : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)), [rooms, sort]);

  return <main className="mx-auto max-w-site px-4 py-6 sm:px-6 lg:py-8">
    <section className="relative overflow-hidden rounded-[22px] border border-[#DCEBD6] bg-[#F3F9F0]">
      <HowItWorks />
      <div className="grid lg:grid-cols-[minmax(0,1.32fr)_minmax(0,1fr)]">
        <div className="px-5 pb-6 pt-16 sm:px-8 sm:pt-8 lg:py-9 lg:pl-9 lg:pr-10">
          <h1 className="text-[28px] font-bold leading-tight text-[#10231A] sm:text-3xl">Shop Together</h1>
          <p className="mt-2 text-[15px] text-[#3F4A44]">Create a shared shopping room and invite family or friends to shop together.</p>
          <ul className="mt-7 grid gap-5 sm:grid-cols-3 sm:gap-4">{features.map(({ icon: Icon, title, text }) => <li key={title} className="flex items-start gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E3F2DD] text-[#0B5A2E]"><Icon className="h-6 w-6" strokeWidth={1.9} aria-hidden="true" /></span>
            <span className="min-w-0 pt-0.5"><span className="block text-[15px] font-semibold text-[#10231A]">{title}</span><span className="mt-1 block text-[13px] leading-snug text-[#5B6660]">{text}</span></span>
          </li>)}</ul>
          <LoadingForm onSubmit={e => create(e)} className="mt-8">
            <label htmlFor="together-room-name" className="block text-sm font-semibold text-[#10231A]">Shopping room name</label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input id="together-room-name" name="name" maxLength={160} required placeholder="e.g. Family shopping, Wedding, New Home..."
                className="h-12 w-full min-w-0 rounded-xl border border-[#D6E2D2] sm:flex-1 bg-white px-4 text-[15px] text-[#10231A] placeholder:text-[#8A938D] focus:border-[#7CB342] focus:outline-none focus:ring-2 focus:ring-[#CDEB9A]" />
              <LoadingButton className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 text-[15px] font-semibold text-[#10231A] shadow-[0_4px_12px_rgba(122,170,30,0.25)] hover:bg-brand-hover">Create room<ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" /></LoadingButton>
            </div>
          </LoadingForm>
        </div>
        <div className="flex items-end justify-center px-5 pb-3 lg:border-l lg:border-[#E2EDDD] lg:px-4 lg:pb-4 lg:pt-16">
          <Image src="/branding/together/shop-together-illustration.png" alt="Family and friends shopping together on a phone and laptop" width={1637} height={960} priority
            sizes="(max-width: 1023px) 90vw, 520px" className="h-auto w-full max-w-[420px] object-contain lg:max-w-[560px]" />
        </div>
      </div>
    </section>

    <p role="status" className={message ? "mt-4 rounded-xl border border-[#DCEBD6] bg-[#F6FBF3] px-4 py-3 text-sm text-[#10231A]" : "sr-only"}>{message}</p>
    {invite && <label className="mt-3 block text-sm font-medium text-[#10231A]">Invite link<input aria-label="Invitation link" readOnly value={invite} onFocus={e => e.currentTarget.select()} className="mt-1.5 w-full min-w-0 rounded-xl border border-[#D6E2D2] bg-white p-2.5 text-sm" /></label>}

    <section aria-labelledby="together-rooms" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="together-rooms" className="flex items-center gap-2.5 text-xl font-bold text-[#10231A]">Your Shopping Rooms{isCustomer && loaded && <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[#EEF1ED] px-2 text-sm font-semibold text-[#334155]">{rooms.length}</span>}</h2>
        {isCustomer && rooms.length > 1 && <div className="flex items-center gap-2.5">
          <label className="relative">
            <span className="sr-only">Sort rooms</span>
            <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="h-10 appearance-none rounded-xl border border-[#E2E6E0] bg-white pl-3.5 pr-9 text-sm font-medium text-[#10231A] focus:border-[#7CB342] focus:outline-none focus:ring-2 focus:ring-[#CDEB9A]">
              <option value="latest">Sort: Latest</option><option value="oldest">Sort: Oldest</option><option value="name">Sort: Name (A–Z)</option><option value="products">Sort: Most products</option>
            </select>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#334155]"><path fill="currentColor" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" /></svg>
          </label>
          <div className="flex rounded-xl border border-[#E2E6E0] bg-white p-1" role="group" aria-label="Room layout">
            {([["grid", LayoutGrid, "Grid view"], ["list", List, "List view"]] as const).map(([id, Icon, label]) => <button key={id} type="button" aria-pressed={view === id} aria-label={label} title={label} onClick={() => setView(id)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link ${view === id ? "bg-[#E3F2DD] text-[#0B5A2E]" : "text-[#475569] hover:bg-[#F3F6F2]"}`}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></button>)}
          </div>
        </div>}
      </div>

      {!isCustomer && <div className="mt-4 rounded-2xl border border-dashed border-[#D6E2D2] bg-white px-6 py-8 text-center"><p className="text-[15px] text-[#3F4A44]">Sign in to see the rooms you created or joined.</p><LoadingButton onClick={() => openAuthModal("login")} className="mt-3 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-[#10231A]">Sign in to view your rooms</LoadingButton></div>}
      {isCustomer && !loaded && !message && <div className="mt-4"><PageSkeleton label="Loading shopping rooms…" variant="cards" rows={3} /></div>}
      {isCustomer && loaded && !rooms.length && <p className="mt-4 rounded-2xl border border-dashed border-[#D6E2D2] bg-white px-6 py-8 text-center text-[15px] text-[#3F4A44]">No rooms yet. Create a Family Cart or join using an invite link.</p>}

      <div className={`mt-4 grid gap-4 ${view === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>{sorted.map(r => {
        const owner = r.members[0]?.role === "OWNER"; const { icon: Icon, tone } = roomStyle(r.name);
        const creator = owner ? "Created by you" : r.ownerName ? `Created by ${r.ownerName}` : "Joined";
        return <article key={r.id} className={`min-w-0 rounded-2xl border border-[#E5E8E3] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5 ${view === "list" ? "sm:flex sm:items-center sm:gap-5" : ""}`}>
          <div className={`flex min-w-0 items-start gap-4 ${view === "list" ? "sm:flex-1" : ""}`}>
            <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-8 w-8" strokeWidth={1.8} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1 pt-1">
              <h3 className="break-words text-[15px] font-semibold text-[#10231A]">{r.name}{r.archived && <span className="ml-2 rounded-full bg-[#F1F3F1] px-2 py-0.5 align-middle text-[11px] font-semibold text-[#5B6660]">Archived</span>}</h3>
              <p className="mt-1 text-[13px] text-[#6B746E]">{creator} &middot; {r._count.members} member{r._count.members === 1 ? "" : "s"} &middot; {r._count.items} product{r._count.items === 1 ? "" : "s"}</p>
            </div>
            {view === "grid" && <RoomMenu room={r} owner={owner} onInvite={() => copyInvite(r)} onArchive={() => archive(r)} />}
          </div>
          <div className={`mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${view === "list" ? "sm:mt-0 sm:flex-nowrap sm:justify-end sm:gap-5" : ""}`}>
            <Avatars room={r} />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Link href={`/together/${r.id}`} className="whitespace-nowrap rounded-xl border border-[#E2E6E0] bg-white px-3 py-2 text-sm font-semibold text-[#10231A] hover:bg-[#F6F9F4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link">Open Room</Link>
              {owner && !r.archived && <LoadingButton className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-primary px-3 py-2 text-sm font-semibold text-[#10231A] hover:bg-brand-hover" onClick={() => copyInvite(r)}><Link2 className="h-4 w-4" aria-hidden="true" />Copy Link</LoadingButton>}
              {view === "list" && <RoomMenu room={r} owner={owner} onInvite={() => copyInvite(r)} onArchive={() => archive(r)} />}
            </div>
          </div>
        </article>;
      })}</div>
    </section>
  </main>;
}
