import Link from "next/link";
import { StoreFollowButton } from "./StoreFollowButton";
export type PublicStore = { id: string; shopName: string; storeSlug: string | null; primaryCategory: string; shopDescription: string | null; _count: { followers: number } };
export function StoreCard({ store }: { store: PublicStore }) {
  return <article className="min-w-0 rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs text-brand-link">{store.primaryCategory}</p><Link className="mt-2 block text-xl font-bold" href={`/stores/${encodeURIComponent(store.storeSlug || store.id)}`}>{store.shopName}</Link><p className="my-3 line-clamp-2 text-sm text-gray-600">{store.shopDescription || "Browse this approved JORO store."}</p><StoreFollowButton vendorId={store.id} initialFollowers={store._count.followers} /></article>;
}