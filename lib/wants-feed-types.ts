import type { ReactionSummary, WantReactionKind } from "./want-social";

/** "all" is the Latest feed; "nearby" is kept so older links (?tab=nearby&city=…) keep working. */
export type WantsFeedTab = "all" | "trending" | "mine" | "joined" | "nearby";
export type WantRequestType = "PRODUCT" | "SERVICE" | "GIFT";

export type WantsFeedViewer = {
  /** Which identity reactions are stored under; null for guests. */
  actor: "customer" | "vendor" | null;
  reaction: WantReactionKind | null;
  joined: boolean;
  isOwner: boolean;
  /** The signed-in vendor's own offer; other vendors' offers are never included. */
  vendorOffer: { id: string; status: string; version: number; latestExpiresAt: string | null } | null;
  canJoin: boolean;
  canOffer: boolean;
};

export type WantsFeedItem = {
  id: string;
  title: string;
  description: string | null;
  /** One primary image; historical data is never deleted, only the first image is shown. */
  images: string[];
  photo: string | null;
  requestType: WantRequestType;
  occasion: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  budgetFlexible: boolean;
  quantity: number;
  category: string;
  city: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  /** Public display name only (first name + last initial); never email, phone or address. */
  customer: { name: string; image: string | null };
  joinedCount: number;
  /** Vendors with a live offer — an aggregate only, never prices or notes. */
  offerVendorCount: number;
  reactions: ReactionSummary;
  viewer: WantsFeedViewer;
  /** Seller offers on this Want; only sent on the owner's "mine" tab. */
  offerCount?: number;
};

export type WantsFeedPage = {
  wants: WantsFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
};
