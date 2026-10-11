import { WantForm } from "@/components/user/WantForm";
import { readCategories } from "@/lib/categories-store";
export const dynamic = "force-dynamic";
export default async function NewWantPage({ searchParams }: { searchParams?: { type?: string } }) {
  const categories = await readCategories();
  const type = searchParams?.type === "service" ? "SERVICE" : searchParams?.type === "gift" ? "GIFT" : "PRODUCT";
  return <main className="mx-auto max-w-2xl px-4 py-10"><h1 className="mb-6 text-3xl font-bold">Post a Request</h1><WantForm categories={categories.map(c => c.name)} initialType={type} /></main>;
}
