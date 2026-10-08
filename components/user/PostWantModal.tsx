"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ClipboardList, LogIn, X } from "lucide-react";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingLink } from "@/components/ui/LoadingLink";
import { WantForm, type SubmittedWant } from "@/components/user/WantForm";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

export function PostWantModal({ initialTitle = "", onClose, onSignIn }: { initialTitle?: string; onClose: () => void; onSignIn: () => void }) {
  const { isCustomer, authLoading, openAuthModal } = useCustomerAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const previousField = useRef<HTMLElement | null>(null);
  const backdropPress = useRef(false);
  const dirty = useRef(false); const [busy, setBusy] = useState(false);
  const markDirty = useCallback((value: boolean) => { dirty.current = value; }, []);
  const [confirmDiscard, setConfirmDiscard] = useState(false); const [submitted, setSubmitted] = useState<SubmittedWant | null>(null);
  const [categories, setCategories] = useState<string[] | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true); const [categoryError, setCategoryError] = useState(""); const [retry, setRetry] = useState(0);
  const everAuthenticated = useRef(isCustomer); if (isCustomer) everAuthenticated.current = true;
  const id = useId(); const formId = `post-want-${id}`;

  useEffect(() => {
    const node = dialog.current; if (!node) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow; const paddingRight = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
    document.body.style.overflow = "hidden";
    if (!node.open) node.showModal();
    return () => {
      node.close(); document.body.style.overflow = overflow; document.body.style.paddingRight = paddingRight;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>("[data-post-want-trigger]")?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController(); setCategoriesLoading(true);
    fetch("/api/categories", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data)) throw new Error("Could not load categories. Please try again.");
        const names = Array.from(new Set(data.map(item => typeof item?.name === "string" ? item.name.trim() : "").filter(Boolean))) as string[];
        if (!names.length) throw new Error("Categories are unavailable right now. Please try again.");
        if (!controller.signal.aborted) { setCategories(names); setCategoryError(""); }
      })
      .catch(error => { if (!controller.signal.aborted) setCategoryError(error instanceof Error ? error.message : "Could not load categories."); })
      .finally(() => { if (!controller.signal.aborted) setCategoriesLoading(false); });
    return () => controller.abort();
  }, [retry]);

  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty.current && !submitted) { previousField.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setConfirmDiscard(true); }
    else onClose();
  }, [busy, submitted, onClose]);
  useEffect(() => {
    if (confirmDiscard) keepEditing.current?.focus();
    else if (previousField.current?.isConnected) previousField.current.focus();
  }, [confirmDiscard]);
  useEffect(() => { if (submitted) successHeading.current?.focus(); }, [submitted]);
  const authenticatedForm = everAuthenticated.current;
  const canSave = authenticatedForm && categories !== null && !categoryError && !categoriesLoading;

  return <dialog ref={dialog} aria-labelledby={`${id}-${confirmDiscard ? "discard-heading" : "heading"}`} aria-describedby={`${id}-${confirmDiscard ? "discard-description" : "description"}`} className="m-auto border-0 bg-transparent p-0 text-brand-dark backdrop:bg-[#062819]/55 backdrop:backdrop-blur-sm" style={{ width: "min(44rem, calc(100vw - 1.5rem))", maxHeight: "calc(100dvh - 1.5rem)" }}
    onCancel={event => { event.preventDefault(); if (confirmDiscard) setConfirmDiscard(false); else requestClose(); }}
    onPointerDown={event => {
      const box = event.currentTarget.getBoundingClientRect();
      backdropPress.current = event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
    }}
    onClick={event => { if (backdropPress.current && event.target === event.currentTarget) requestClose(); backdropPress.current = false; }}>
    <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[26px] border border-emerald-100 bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-emerald-100 px-5 py-5 sm:px-7">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-100 text-emerald-900"><ClipboardList size={23} aria-hidden="true" /></span><div><h2 id={`${id}-heading`} className="text-xl font-extrabold sm:text-2xl">Post a Want</h2><p id={`${id}-description`} className="mt-1 text-sm text-neutral-500">Tell JORO sellers what you’re looking for.</p></div></div>
        <button type="button" aria-label="Close Post a Want" disabled={busy} onClick={requestClose} className="rounded-full p-2 text-emerald-950 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-40"><X size={21} aria-hidden="true" /></button>
      </header>
      {confirmDiscard && <div className="overflow-y-auto px-6 py-8 sm:px-8"><h3 id={`${id}-discard-heading`} className="text-xl font-bold">Discard this Want?</h3><p id={`${id}-discard-description`} className="mt-2 text-neutral-600">Your unsaved details and selected image will be removed.</p><div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-neutral-300 px-5 py-3 font-bold hover:bg-neutral-50">Discard</button><button ref={keepEditing} type="button" onClick={() => setConfirmDiscard(false)} className="rounded-xl bg-brand-primary px-5 py-3 font-bold">Keep editing</button></div></div>}
      {submitted && !confirmDiscard && <div className="overflow-y-auto px-6 py-10 text-center sm:px-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lime-100 text-emerald-900"><Check size={32} aria-hidden="true" /></div>
        <h3 ref={successHeading} tabIndex={-1} className="mt-5 text-xl font-bold outline-none" role="status">Your Want has been submitted for review.</h3><p className="mt-3 text-neutral-600">It will appear in the public feed after approval. You can follow its status in My Wants.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-neutral-300 px-5 py-3 font-bold hover:bg-neutral-50">Done</button><LoadingLink href="/wants?tab=mine" onNavigateComplete={onClose} className="rounded-xl bg-brand-primary px-5 py-3 font-bold text-brand-dark">View My Wants</LoadingLink></div>
      </div>}
      <div hidden={confirmDiscard || !!submitted} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
        {!authenticatedForm ? authLoading ? <div role="status" className="space-y-4 py-5"><div className="h-5 w-1/2 animate-pulse rounded bg-neutral-100" /><div className="h-24 animate-pulse rounded-xl bg-neutral-100" /><span className="sr-only">Checking your account…</span></div> : <div className="py-6 text-center"><LogIn className="mx-auto h-9 w-9 text-emerald-800" aria-hidden="true" /><h3 className="mt-4 text-xl font-bold">Sign in to post a Want</h3><p className="mx-auto mt-2 max-w-sm text-neutral-600">Use your customer account to share what you need. We’ll bring you back here after sign-in.</p><LoadingButton type="button" loadingLabel="Opening…" onClick={() => { onSignIn(); return openAuthModal("login"); }} className="mt-6 rounded-xl bg-brand-primary px-6 py-3 font-bold">Sign in to continue</LoadingButton></div>
          : categoryError ? <div className="rounded-xl border border-red-100 bg-red-50 p-5"><p role="alert" className="text-red-800">{categoryError}</p><LoadingButton type="button" loading={categoriesLoading} loadingLabel="Loading…" onClick={() => { setCategoriesLoading(true); setRetry(value => value + 1); }} className="mt-4 rounded-xl border border-red-200 bg-white px-4 py-2 font-bold text-red-800">Retry</LoadingButton></div>
          : categoriesLoading ? <div role="status" className="space-y-5 py-2">{Array.from({ length: 4 }, (_, index) => <div key={index}><div className="mb-2 h-4 w-1/3 animate-pulse rounded bg-neutral-100" /><div className="h-12 animate-pulse rounded-xl bg-neutral-100" /></div>)}<span className="sr-only">Loading Want form…</span></div>
          : categories && <WantForm categories={categories} initialTitle={initialTitle} formId={formId} embedded hideFooter onBusyChange={setBusy} onDirtyChange={markDirty} onSuccess={setSubmitted} />}
      </div>
      {!confirmDiscard && !submitted && <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-emerald-100 bg-white px-5 py-4 sm:px-7"><button type="button" onClick={requestClose} disabled={busy} className="rounded-xl border border-neutral-300 px-5 py-3 font-bold hover:bg-neutral-50 disabled:opacity-50">Cancel</button>{authenticatedForm && <LoadingButton type="submit" form={formId} loading={busy} loadingLabel="Saving…" disabled={!canSave} className="min-w-24 rounded-xl bg-brand-primary px-6 py-3 font-bold text-brand-dark disabled:opacity-50">Save</LoadingButton>}</footer>}
    </div>
  </dialog>;
}
