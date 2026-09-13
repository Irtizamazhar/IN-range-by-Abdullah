"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { PAKISTANI_CITIES } from "@/lib/pakistani-cities";

export default function NewWantPage() {
  const router = useRouter();
  const { openAuthModal } = useCustomerAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((response) => response.json())
      .then((rows: Array<{ name?: string }>) => setCategories(rows.map((row) => String(row.name || "")).filter(Boolean)))
      .catch(() => setCategories([]));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      title: String(form.get("title") || ""),
      description: String(form.get("description") || ""),
      category: String(form.get("category") || ""),
      city: String(form.get("city") || ""),
      budgetMin: form.get("budgetMin") ? Number(form.get("budgetMin")) : null,
      budgetMax: form.get("budgetMax") ? Number(form.get("budgetMax")) : null,
      quantity: Number(form.get("quantity") || 1),
      condition: String(form.get("condition") || "either"),
    };
    setBusy(true);
    try {
      const response = await fetch("/api/wants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (response.status === 401) {
        openAuthModal("login");
        return;
      }
      if (!response.ok) return toast.error(data.error || "Could not post Want");
      toast.success(data.message || "Want submitted");
      router.push("/account?tab=wants");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-xl border border-borderGray bg-white px-3 py-2.5 text-sm outline-none focus:border-primaryBlue focus:ring-2 focus:ring-primaryBlue/15";
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/wants" className="text-sm font-bold text-brand-link">← Browse Wants</Link>
      <section className="mt-4 rounded-[22px] border border-borderGray bg-white p-6 shadow-card sm:p-8">
        <p className="text-sm font-black uppercase tracking-wider text-brand-link">Tell sellers what you need</p>
        <h1 className="mt-1 text-3xl font-black text-brand-dark">Post a Want</h1>
        <p className="mt-2 text-sm leading-6 text-darkText/60">Your request is reviewed before approved vendors can see and respond to it.</p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block text-sm font-bold text-darkText">What do you need?<input required minLength={5} maxLength={200} name="title" className={field} placeholder="e.g. Gaming laptop under Rs. 250,000" /></label>
          <label className="block text-sm font-bold text-darkText">Details<textarea required minLength={10} maxLength={3000} name="description" rows={5} className={field} placeholder="Specifications, preferred brand, timing, or anything sellers should know" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-darkText">Category<select required name="category" className={field}><option value="">Select category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="block text-sm font-bold text-darkText">City<select required name="city" className={field}><option value="">Select city</option>{PAKISTANI_CITIES.map((city) => <option key={city}>{city}</option>)}</select></label>
            <label className="block text-sm font-bold text-darkText">Minimum budget (optional)<input min={1} type="number" name="budgetMin" className={field} /></label>
            <label className="block text-sm font-bold text-darkText">Maximum budget (optional)<input min={1} type="number" name="budgetMax" className={field} /></label>
            <label className="block text-sm font-bold text-darkText">Quantity<input required min={1} max={100} type="number" name="quantity" defaultValue={1} className={field} /></label>
            <label className="block text-sm font-bold text-darkText">Condition<select name="condition" defaultValue="either" className={field}><option value="either">New or used</option><option value="new">New</option><option value="used">Used</option></select></label>
          </div>
          <button disabled={busy} className="w-full rounded-xl bg-brand-primary px-5 py-3 font-black text-brand-dark hover:bg-brand-hover disabled:opacity-60">{busy ? "Submitting…" : "Submit for review"}</button>
        </form>
      </section>
    </main>
  );
}
