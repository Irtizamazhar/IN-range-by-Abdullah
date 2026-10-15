"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LogoMark } from "@/components/user/LogoMark";

export default function UnsubscribePage() {
  return <Suspense fallback={<main className="min-h-dvh bg-emerald-50" />}><UnsubscribeContent /></Suspense>;
}

function UnsubscribeContent() {
  const token = useSearchParams()?.get("token") || "";
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  async function confirm() {
    setStatus("saving");
    try {
      const response = await fetch("/api/marketing/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!response.ok) throw new Error();
      setStatus("done");
    } catch { setStatus("error"); }
  }
  return <main className="flex min-h-dvh items-center justify-center bg-emerald-50 p-4"><section className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-lg sm:p-8"><div className="mx-auto w-fit"><LogoMark href={null} /></div><h1 className="mt-4 text-2xl font-bold text-[#005055]">Email preferences</h1><p className="mt-3 text-sm text-slate-600">Stop receiving JORO promotional emails. Account and order emails will continue.</p>{status === "done" ? <p role="status" className="mt-6 font-semibold text-emerald-800">You have been unsubscribed.</p> : <><button type="button" disabled={!token || status === "saving"} onClick={confirm} className="mt-6 w-full rounded-xl bg-[#005055] px-4 py-3 font-semibold text-white disabled:opacity-50">{status === "saving" ? "Saving…" : "Unsubscribe"}</button>{status === "error" && <p role="alert" className="mt-3 text-sm text-red-700">Could not update your preference. Please try again.</p>}</>}</section></main>;
}
