"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BadgeCheck, Check, Flag, Loader2, MoreHorizontal, Send, Store, UserPlus, UsersRound } from "lucide-react";
import Link from "@/components/ui/LoadingLink";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import {
  WANT_REACTIONS,
  WANT_REPORT_REASONS,
  offerStatusLabel,
  topReactions,
  type ReactionSummary,
  type WantReactionKind,
} from "@/lib/want-social";
import type { WantsFeedViewer } from "@/lib/wants-feed-types";
import styles from "./WantSocial.module.css";

export type SocialWant = {
  id: string;
  title: string;
  status: string;
  expiresAt: string;
  joinedCount: number;
  offerVendorCount: number;
  reactions: ReactionSummary;
  viewer: WantsFeedViewer;
  offerCount?: number;
};

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(data?.error || "Something went wrong. Please try again."), { status: response.status });
  return data;
}

function applyReaction(summary: ReactionSummary, from: WantReactionKind | null, to: WantReactionKind | null): ReactionSummary {
  const counts = { ...summary.counts };
  let total = summary.total;
  if (from) { counts[from] = Math.max(0, counts[from] - 1); total = Math.max(0, total - 1); }
  if (to) { counts[to] += 1; total += 1; }
  return { total, counts };
}

/** Closes a popover when focus or a click lands outside it, or on Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) close(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

/** Reaction totals plus joined customers and vendors who offered — aggregates only, never offer details. */
export function WantSocialCounts({ want, reactions }: { want: SocialWant; reactions: ReactionSummary }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const top = topReactions(reactions);
  return <div className={styles.counts}>
    <div ref={ref} className={styles.reactWrap}>
      {reactions.total > 0
        ? <button type="button" className={styles.summaryButton} aria-expanded={open} aria-label={`${reactions.total} reactions. Show breakdown`} onClick={() => setOpen(value => !value)}>
            <span className={styles.summaryEmojis} aria-hidden="true">{top.map(reaction => <span key={reaction.type}>{reaction.emoji}</span>)}</span>
            {reactions.total.toLocaleString("en-PK")}
          </button>
        : <span className={styles.count}>No reactions yet</span>}
      {open && <ul className={styles.breakdown} aria-label="Reaction breakdown">
        {WANT_REACTIONS.map(reaction => <li key={reaction.type}><span>{reaction.emoji} {reaction.label}</span><strong>{reactions.counts[reaction.type]}</strong></li>)}
      </ul>}
    </div>
    <div className={styles.countGroup}>
      <span className={styles.count}><UsersRound aria-hidden="true" />{want.joinedCount.toLocaleString("en-PK")} joined</span>
      <span className={styles.count}><Store aria-hidden="true" />{want.offerVendorCount.toLocaleString("en-PK")} {want.offerVendorCount === 1 ? "vendor offered" : "vendors offered"}</span>
    </div>
  </div>;
}

function ReactionPicker({ want, reactions, mine, onChange }: { want: SocialWant; reactions: ReactionSummary; mine: WantReactionKind | null; onChange: (summary: ReactionSummary, mine: WantReactionKind | null) => void }) {
  const { openAuthModal } = useCustomerAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useDismiss(open, () => setOpen(false));
  const hoverTimer = useRef<number | undefined>(undefined);
  const current = WANT_REACTIONS.find(reaction => reaction.type === mine);
  const open_ = want.status === "OPEN" && new Date(want.expiresAt).getTime() > Date.now();

  async function choose(type: WantReactionKind) {
    setOpen(false);
    if (busy) return;
    if (!want.viewer.actor) { void openAuthModal("login"); return; }
    const next = mine === type ? null : type;
    const before = { reactions, mine };
    setBusy(true); setError("");
    onChange(applyReaction(reactions, mine, next), next);
    try {
      const data = next
        ? await send(`/api/wants/${want.id}/reaction`, "PUT", { type: next })
        : await send(`/api/wants/${want.id}/reaction`, "DELETE");
      onChange(data.reactions, data.reaction ?? null);
    } catch (failure) {
      onChange(before.reactions, before.mine);
      setError(failure instanceof Error ? failure.message : "Could not save your reaction.");
    } finally { setBusy(false); }
  }

  return <div ref={ref} className={styles.reactWrap}
    onMouseEnter={() => { window.clearTimeout(hoverTimer.current); hoverTimer.current = window.setTimeout(() => open_ && setOpen(true), 350); }}
    onMouseLeave={() => { window.clearTimeout(hoverTimer.current); hoverTimer.current = window.setTimeout(() => setOpen(false), 300); }}>
    <button type="button" className={styles.reactButton} data-active={!!current} disabled={!open_ || busy}
      aria-haspopup="true" aria-expanded={open} aria-label={current ? `Your reaction: ${current.label}. Change reaction` : "React to this Want"}
      onClick={() => { if (!want.viewer.actor) { void openAuthModal("login"); return; } setOpen(value => !value); }}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <span className={styles.reactEmoji} aria-hidden="true">{current?.emoji ?? "👍"}</span>}
      {current?.label ?? "React"}
    </button>
    {open && <div className={styles.picker} role="group" aria-label="Choose a reaction">
      {WANT_REACTIONS.map(reaction => <button key={reaction.type} type="button" className={styles.pickerOption} title={reaction.label}
        aria-label={mine === reaction.type ? `Remove ${reaction.label}` : reaction.label} aria-pressed={mine === reaction.type} onClick={() => void choose(reaction.type)}>
        <span aria-hidden="true">{reaction.emoji}</span>
      </button>)}
    </div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}

function JoinButton({ want, onJoined }: { want: SocialWant; onJoined: (joined: boolean, count: number) => void }) {
  const { openAuthModal } = useCustomerAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const joined = want.viewer.joined;
  const open = want.status === "OPEN" && new Date(want.expiresAt).getTime() > Date.now();

  async function toggle() {
    if (busy) return;
    if (want.viewer.actor !== "customer") { void openAuthModal("login"); return; }
    setBusy(true); setError("");
    try {
      const data = await send(`/api/wants/${want.id}/interest`, joined ? "DELETE" : "PUT");
      onJoined(Boolean(data.joined), Number(data.count) || 0);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not update this request."); }
    finally { setBusy(false); }
  }

  if (!open && !joined) return <button type="button" className={styles.ghostButton} disabled>Closed</button>;
  return <>
    <button type="button" className={styles.joinButton} aria-pressed={joined} disabled={busy}
      title={joined ? "You joined this request. Click to leave." : "Join if you need the same thing"} onClick={() => void toggle()}>
      {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : joined ? <Check aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
      {joined ? "Joined" : "Join Request"}
      {joined && <span className={styles.srOnly}>. Activate to leave this request</span>}
    </button>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </>;
}

function VendorOfferAction({ want }: { want: SocialWant }) {
  const offer = want.viewer.vendorOffer;
  if (!offer) {
    return want.viewer.canOffer
      ? <Link href={`/vendor/dashboard/demand/${want.id}`} className={styles.offerButton}><Send aria-hidden="true" />Send Offer</Link>
      : null;
  }
  const label = offerStatusLabel({ status: offer.status, version: offer.version, latestExpiresAt: offer.latestExpiresAt });
  const live = label === "Submitted" || label === "Revised" || label === "Countered";
  return <>
    <span className={styles.offerState} data-tone={live || label === "Accepted" ? undefined : "muted"}>
      <BadgeCheck aria-hidden="true" />{live ? "Offered" : label}
    </span>
    <Link href={`/vendor/dashboard/offers#${offer.id}`} className={styles.ghostButton}>{live ? "View / Edit Offer" : "View Offer"}</Link>
  </>;
}

/**
 * Bottom action row of a Want card: reaction picker at the bottom-left, then Join (customers),
 * Send Offer (approved vendors) or View offers (owner). Every action is re-checked on the server.
 */
export function WantSocialBar({ want: initial, ownerOffersHref }: { want: SocialWant; ownerOffersHref?: string }) {
  const [want, setWant] = useState(initial);
  useEffect(() => setWant(initial), [initial]);
  const { viewer } = want;
  return <>
    <WantSocialCounts want={want} reactions={want.reactions} />
    <div className={styles.bar}>
      <ReactionPicker want={want} reactions={want.reactions} mine={viewer.reaction}
        onChange={(reactions, reaction) => setWant(current => ({ ...current, reactions, viewer: { ...current.viewer, reaction } }))} />
      <div className={styles.actionsEnd}>
        {viewer.isOwner
          ? ownerOffersHref && <Link href={ownerOffersHref} className={styles.ghostButton}>View private offers{typeof want.offerCount === "number" ? ` (${want.offerCount})` : ""}</Link>
          : viewer.actor === "vendor"
            ? <VendorOfferAction want={want} />
            : <JoinButton want={want} onJoined={(joined, joinedCount) => setWant(current => ({ ...current, joinedCount, viewer: { ...current.viewer, joined } }))} />}
      </div>
    </div>
  </>;
}

/** "More" menu on a Want card with a report form. Owners don't see it. */
export function WantReportMenu({ wantId, viewer }: { wantId: string; viewer: WantsFeedViewer }) {
  const { openAuthModal } = useCustomerAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ref = useDismiss(open, () => setOpen(false));
  if (viewer.isOwner) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      await send(`/api/wants/${wantId}/report`, "POST", { reason: String(form.get("reason") || ""), details: String(form.get("details") || "").trim() || undefined });
      setMessage("Thanks — our team will review this post.");
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not send your report."); }
    finally { setBusy(false); }
  }

  return <div ref={ref} className={styles.menuWrap}>
    <button type="button" className={styles.menuButton} aria-label="More options" aria-haspopup="true" aria-expanded={open}
      onClick={() => { if (!viewer.actor) { void openAuthModal("login"); return; } setOpen(value => !value); }}>
      <MoreHorizontal aria-hidden="true" />
    </button>
    {open && <form className={styles.menu} onSubmit={event => void submit(event)}>
      <h3><Flag className="mr-1 inline h-4 w-4" aria-hidden="true" />Report this Want</h3>
      <label>Reason<select name="reason" required defaultValue=""><option value="" disabled>Choose a reason</option>{WANT_REPORT_REASONS.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label>
      <label>Details (optional)<textarea name="details" maxLength={1000} placeholder="Anything our team should know" /></label>
      {message && <p role="status" className={styles.hint}>{message}</p>}
      <div className={styles.menuActions}>
        <button type="button" className={styles.ghostButton} onClick={() => setOpen(false)}>Close</button>
        <button type="submit" className={styles.joinButton} disabled={busy}>{busy ? "Sending…" : "Send report"}</button>
      </div>
    </form>}
  </div>;
}
