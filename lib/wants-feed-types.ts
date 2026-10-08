export type WantsFeedTab = "all" | "nearby" | "mine";

export type WantsFeedItem = {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  photo: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  budgetFlexible: boolean;
  quantity: number;
  category: string;
  city: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  customer: { name: string; image: string | null };
};

export type WantsFeedPage = {
  wants: WantsFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
};
