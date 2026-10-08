"use client";

import { LoadingButton } from "@/components/ui/LoadingButton";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useLoadingRouter();
  return <section className="mx-auto max-w-xl px-5 py-16 text-center">
    <h1 className="text-2xl font-bold text-brand-dark">This page could not be loaded</h1>
    <p role="alert" className="mt-3 text-darkText/70">Please try again. If the problem continues, check your connection.</p>
    <LoadingButton type="button" loadingLabel="Retrying…" onClick={async () => { reset(); await router.refresh(); }} className="mt-6 rounded-xl bg-brand-primary px-5 py-3 font-bold text-brand-dark">Try again</LoadingButton>
  </section>;
}
