import { publicStores } from "@/lib/store-service";
import { StoreCard } from "@/components/user/StoreCard";
export const dynamic = "force-dynamic";
export default async function StoresPage() {
  try {
    const stores = await publicStores();
    return <main className="mx-auto max-w-7xl px-4 py-10"><h1 className="text-3xl font-bold">Stores on JORO</h1><p className="my-4 text-gray-600">Browse approved stores and follow the sellers you like.</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stores.map(store => <StoreCard key={store.id} store={store} />)}</div>{!stores.length && <p className="rounded-2xl bg-white p-6">No public stores yet.</p>}</main>;
  } catch { return <main className="mx-auto max-w-7xl p-8"><h1 className="text-3xl font-bold">Stores</h1><p role="alert" className="mt-4">Stores are temporarily unavailable. Please try again later.</p></main>; }
}