/**
 * Wants social layer — pure helpers shared by the feed UI and the server.
 * No Prisma or Node imports: this file is bundled into client components.
 */

export const WANT_REACTIONS = [
  { type: "LIKE", emoji: "👍", label: "Like" },
  { type: "LOVE", emoji: "❤️", label: "Love" },
  { type: "SUPPORT", emoji: "🙌", label: "Support" },
  { type: "WOW", emoji: "😮", label: "Wow" },
  { type: "FIRE", emoji: "🔥", label: "Fire" },
] as const;

export type WantReactionKind = (typeof WANT_REACTIONS)[number]["type"];
export type ReactionCounts = Record<WantReactionKind, number>;
export type ReactionSummary = { total: number; counts: ReactionCounts };

const REACTION_TYPES = new Set<string>(WANT_REACTIONS.map((reaction) => reaction.type));

export function isWantReaction(value: unknown): value is WantReactionKind {
  return typeof value === "string" && REACTION_TYPES.has(value);
}

export function emptyReactionSummary(): ReactionSummary {
  return { total: 0, counts: { LIKE: 0, LOVE: 0, SUPPORT: 0, WOW: 0, FIRE: 0 } };
}

export function summarizeReactions(rows: Array<{ type: string; count: number }>): ReactionSummary {
  const summary = emptyReactionSummary();
  for (const row of rows) {
    if (!isWantReaction(row.type) || row.count <= 0) continue;
    summary.counts[row.type] += row.count;
    summary.total += row.count;
  }
  return summary;
}

/** Most-used reactions first, for the compact summary next to the picker. */
export function topReactions(summary: ReactionSummary, limit = 3) {
  return WANT_REACTIONS.filter((reaction) => summary.counts[reaction.type] > 0)
    .sort((a, b) => summary.counts[b.type] - summary.counts[a.type])
    .slice(0, limit);
}

/** First name plus last initial ("Ayesha K."), so public posts never show a full legal name. */
export function publicDisplayName(name: string | null | undefined) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "JORO member";
  const first = parts[0].slice(0, 40);
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
}

/** "just now", "5m", "3h", "2d", then a short date. */
export function relativeTime(iso: string, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric" });
}

export const WANT_TYPE_LABELS: Record<string, string> = { PRODUCT: "Product", SERVICE: "Service", GIFT: "Gift" };

/** Stored WantOffer statuses that still count as a vendor's live offer on a Want. */
export const ACTIVE_OFFER_STATUSES = ["SUBMITTED", "COUNTERED", "ACCEPTED"] as const;

export type OfferStatusLabel = "Submitted" | "Revised" | "Countered" | "Accepted" | "Rejected" | "Withdrawn" | "Expired";

/**
 * Maps stored values (SUBMITTED, COUNTERED, ACCEPTED, REJECTED, WITHDRAWN) onto the workflow labels
 * without rewriting history: a vendor revision keeps SUBMITTED with a higher version (Revised), and an
 * open offer past its latest expiry reads as Expired.
 */
export function offerStatusLabel(offer: { status: string; version?: number; latestExpiresAt?: string | Date | null }, now = Date.now()): OfferStatusLabel {
  const open = offer.status === "SUBMITTED" || offer.status === "COUNTERED";
  if (open && offer.latestExpiresAt && new Date(offer.latestExpiresAt).getTime() <= now) return "Expired";
  switch (offer.status) {
    case "SUBMITTED": return (offer.version ?? 1) > 1 ? "Revised" : "Submitted";
    case "COUNTERED": return "Countered";
    case "ACCEPTED": return "Accepted";
    case "REJECTED": return "Rejected";
    case "WITHDRAWN": return "Withdrawn";
    default: return "Submitted";
  }
}

export const WANT_REPORT_REASONS = [
  { value: "SPAM", label: "Spam or advertising" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "PROHIBITED", label: "Prohibited item or service" },
  { value: "SCAM", label: "Scam or fraud" },
  { value: "PERSONAL_INFO", label: "Shares private contact details" },
  { value: "OTHER", label: "Something else" },
] as const;
export type WantReportReason = (typeof WANT_REPORT_REASONS)[number]["value"];
