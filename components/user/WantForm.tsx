"use client";
import { blockNonDigitKeys, wholeNumber } from "@/lib/whole-number-input";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { MAX_WANT_PHOTOS } from "@/lib/want-images";
import { Image as ImageIcon, Plus, ShieldCheck, X } from "lucide-react";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { LoadingLink } from "@/components/ui/LoadingLink";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { wantInput } from "@/lib/want-schema";
import { PakistanCitySelect } from "@/components/ui/PakistanCitySelect";

export type SubmittedWant = { id: string; status: string };
/** Existing Want loaded for editing; saving sends it back through moderation. */
export type EditableWant = { id: string; values: Partial<WantValues>; photos: string[] };
/** A reference image in the form: an already-saved one (`url`) or a newly chosen/pasted file with a local preview. */
type PhotoItem = { key: string; file: File | null; url: string; preview: string };
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const savedPhoto = (url: string): PhotoItem => ({ key: url, file: null, url, preview: url });
type WantFormProps = {
  categories: string[]; initialTitle?: string; initialType?: "PRODUCT" | "SERVICE" | "GIFT"; formId?: string; hideFooter?: boolean; embedded?: boolean; editWant?: EditableWant; lockKeyFields?: boolean;
  onSuccess?: (want: SubmittedWant) => void; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void;
};
export type WantValues = {
  requestType: "PRODUCT" | "SERVICE" | "GIFT";
  occasion: string;
  title: string; category: string; city: string; quantity: string; min: string; max: string; description: string;
  condition: "Any" | "New" | "Used" | "Refurbished"; needBy: string; flexible: boolean;
};
const emptyValues = (title = "", requestType: WantValues["requestType"] = "PRODUCT"): WantValues => ({ requestType, occasion: "", title, category: "", city: "", quantity: "1", min: "", max: "", description: "", condition: "Any", needBy: "", flexible: false });
function dateAfter(days: number) {
  const date = new Date(); date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function WantForm({ categories, initialTitle, initialType = "PRODUCT", formId, hideFooter = false, embedded = false, editWant, lockKeyFields = false, onSuccess, onDirtyChange, onBusyChange }: WantFormProps) {
  const router = useLoadingRouter();
  const { isCustomer, authLoading, openAuthModal } = useCustomerAuth();
  const generatedId = useId(); const id = formId || `want-form-${generatedId}`;
  const initial = useRef(editWant ? { ...emptyValues("", initialType), ...editWant.values } : emptyValues(initialTitle, initialType));
  const [values, setValues] = useState<WantValues>(initial.current);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [photoError, setPhotoError] = useState("");
  const initialPhotos = useRef(editWant?.photos || []);
  const [photos, setPhotos] = useState<PhotoItem[]>(() => initialPhotos.current.map(savedPhoto));
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedWant | null>(null);
  const fileInput = useRef<HTMLInputElement>(null); const lock = useRef(false); const completed = useRef(false);
  const moreDetails = useRef<HTMLDetailsElement>(null);
  const errorMessage = useRef<HTMLDivElement>(null);
  /** Upload results by item key, so a retried submit does not upload the same file twice. */
  const uploadedPhotos = useRef(new Map<string, string>());
  const photoCounter = useRef(0);
  /** Scroll position of the enclosing scroll body while the native file picker is open. */
  const pickerScroll = useRef<{ body: HTMLElement; top: number } | null>(null);
  const hadCustomer = useRef(isCustomer); if (isCustomer) hadCustomer.current = true;
  const photosDiffer = (list: PhotoItem[]) => list.map(p => p.file ? p.key : p.url).join("\n") !== initialPhotos.current.join("\n");
  const photoChanged = photosDiffer(photos);
  const dirty = !submitted && (photoChanged || JSON.stringify(values) !== JSON.stringify(initial.current));

  useEffect(() => {
    if (initialTitle !== undefined) return;
    const title = new URLSearchParams(window.location.search).get("title") || "";
    if (title) { initial.current = emptyValues(title, initialType); setValues(initial.current); }
  }, [initialTitle, initialType]);
  useEffect(() => {
    if (!dirty) return;
    const protectUnsavedWant = (event: BeforeUnloadEvent) => {
      if (completed.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectUnsavedWant);
    return () => window.removeEventListener("beforeunload", protectUnsavedWant);
  }, [dirty]);
  // Free local previews when the form goes away; removed items are revoked as they are removed.
  const latestPhotos = useRef(photos); latestPhotos.current = photos;
  useEffect(() => () => { for (const p of latestPhotos.current) if (p.file) URL.revokeObjectURL(p.preview); }, []);
  // Choosing (or cancelling) an image must never move the form; put the scroll body back where the user left it.
  useLayoutEffect(() => {
    const saved = pickerScroll.current; if (!saved) return;
    saved.body.scrollTop = saved.top; pickerScroll.current = null;
  }, [photos, photoError]);
  useEffect(() => {
    const input = fileInput.current; if (!input) return;
    const restore = () => { const saved = pickerScroll.current; if (saved) { saved.body.scrollTop = saved.top; pickerScroll.current = null; } };
    input.addEventListener("cancel", restore); return () => input.removeEventListener("cancel", restore);
  }, []);
  useEffect(() => {
    if (error) { errorMessage.current?.focus({ preventScroll: true }); errorMessage.current?.scrollIntoView({ block: "nearest" }); }
  }, [error]);

  function change<K extends keyof WantValues>(key: K, value: WantValues[K]) {
    const next = { ...values, [key]: value };
    // Escape/backdrop events can arrive before React flushes passive effects.
    // Notify the dialog during the field event so its dismissal guard is current.
    onDirtyChange?.(photoChanged || JSON.stringify(next) !== JSON.stringify(initial.current));
    setValues(next);
  }
  function updatePhotos(next: PhotoItem[]) {
    onDirtyChange?.(photosDiffer(next) || JSON.stringify(values) !== JSON.stringify(initial.current));
    setPhotos(next);
  }
  function addPhotos(files: File[]) {
    if (!files.length) return;
    const valid = files.filter(file => PHOTO_TYPES.has(file.type.toLowerCase()) && file.size <= 5 * 1024 * 1024);
    const room = MAX_WANT_PHOTOS - photos.length;
    const added = valid.slice(0, Math.max(room, 0)).map(file => {
      photoCounter.current += 1;
      return { key: `new-${photoCounter.current}`, file, url: "", preview: URL.createObjectURL(file) };
    });
    setPhotoError(
      valid.length < files.length ? "Only JPG, PNG, or WebP images up to 5 MB can be added."
      : valid.length > added.length ? `You can add up to ${MAX_WANT_PHOTOS} images.`
      : "",
    );
    if (added.length) updatePhotos([...photos, ...added]);
  }
  function removePhoto(key: string) {
    const item = photos.find(p => p.key === key); if (!item) return;
    if (item.file) URL.revokeObjectURL(item.preview);
    uploadedPhotos.current.delete(key); setPhotoError("");
    updatePhotos(photos.filter(p => p.key !== key));
  }
  /** Ctrl+V / Cmd+V while this form is open adds copied images; pasting text into a field works as usual. */
  const pasteRef = useRef<(event: ClipboardEvent) => void>(() => undefined);
  pasteRef.current = (event: ClipboardEvent) => {
    if (busy || submitted || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target.closest("form") : null;
    if (target && target.id !== id) return; // pasted into some other form on the page
    const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault(); addPhotos(files);
  };
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => pasteRef.current(event);
    document.addEventListener("paste", onPaste); return () => document.removeEventListener("paste", onPaste);
  }, []);
  function openPhotoPicker() {
    const body = fileInput.current?.closest<HTMLElement>("[data-want-scroll-body]");
    pickerScroll.current = body ? { body, top: body.scrollTop } : null;
    fileInput.current?.click();
  }
  function photoSelected(event: ChangeEvent<HTMLInputElement>) {
    addPhotos(Array.from(event.target.files || []));
    event.target.value = ""; // lets the same file be picked again
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current || completed.current) return;
    if (!isCustomer) { setError("Your session has expired. Sign in again, then retry. Your Want is still here."); return; }
    setError("");
    const input = wantInput.safeParse({
      requestType: values.requestType,
      occasion: values.requestType === "GIFT" ? values.occasion : null,
      title: values.title, category: values.category, city: values.city, quantity: Number(values.quantity), budgetFlexible: values.flexible,
      budgetMin: values.flexible ? null : Number(values.min || 0), budgetMax: values.flexible ? null : Number(values.max),
      description: values.description, condition: values.condition, needBy: values.needBy ? new Date(values.needBy).toISOString() : null,
    });
    if (!input.success) { setError(input.error.issues[0]?.message || "Please check the supplied fields."); return; }
    lock.current = true; setBusy(true); onBusyChange?.(true);
    try {
      const photoUrls: string[] = [];
      for (const item of photos) {
        if (!item.file) { photoUrls.push(item.url); continue; }
        let url = uploadedPhotos.current.get(item.key);
        if (!url) {
          const uploadData = new FormData(); uploadData.set("file", item.file); uploadData.set("folder", "inrange-wants");
          const response = await fetch("/api/upload", { method: "POST", body: uploadData });
          const result = await response.json().catch(() => null);
          if (!response.ok || typeof result?.url !== "string") throw new Error(result?.error || "Could not upload the photo. Please try again.");
          url = result.url as string; uploadedPhotos.current.set(item.key, url);
        }
        photoUrls.push(url);
      }
      const response = await fetch(editWant ? `/api/wants/${editWant.id}` : "/api/wants", { method: editWant ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input.data, photos: photoUrls }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.want?.id !== "string") throw new Error(result?.error || (editWant ? "Could not save your changes. Please try again." : "Could not submit your Want. Please try again."));
      const want: SubmittedWant = { id: result.want.id, status: result.want.status };
      completed.current = true; setSubmitted(want); onDirtyChange?.(false); window.dispatchEvent(new Event("wants-changed"));
      if (onSuccess) onSuccess(want); else await router.push(`/wants/${want.id}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not submit your Want. Please try again."); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  }

  if (!hadCustomer.current && (authLoading || !isCustomer)) return <div className="rounded-2xl border border-emerald-100 bg-white p-6 text-brand-dark">
    {authLoading ? <p role="status" className="animate-pulse">Checking your account…</p> : <><h2 className="text-xl font-bold">Sign in to post a Want</h2><p className="mt-2 text-neutral-600">Use your customer account to tell trusted sellers what you need.</p><LoadingButton type="button" onClick={() => openAuthModal("login")} loadingLabel="Opening…" className="mt-5 rounded-xl bg-brand-primary px-5 py-3 font-bold">Sign in to continue</LoadingButton></>}
  </div>;

  return <LoadingForm id={id} onSubmit={submit} className={`joro-form space-y-5 ${embedded ? "" : "rounded-2xl bg-white p-6"}`}>
    <fieldset disabled={busy || !!submitted} className="min-w-0 space-y-5 disabled:opacity-70">
      <label className="font-semibold text-brand-dark">Request type <select name="requestType" disabled={lockKeyFields} value={values.requestType} onChange={event => change("requestType", event.target.value as WantValues["requestType"])}><option value="PRODUCT">Product requirement</option><option value="SERVICE">Service requirement</option><option value="GIFT">Gift requirement</option></select></label>
      {values.requestType === "GIFT" && <label className="font-semibold text-brand-dark">Occasion <span aria-hidden="true">*</span><input name="occasion" required value={values.occasion} onChange={event => change("occasion", event.target.value)} maxLength={100} placeholder="Birthday, wedding, anniversary..." /></label>}
      {values.requestType !== "PRODUCT" && <label className="font-semibold text-brand-dark">Description <span aria-hidden="true">*</span><textarea name="description" required minLength={10} maxLength={5000} rows={4} value={values.description} onChange={event => change("description", event.target.value)} placeholder={values.requestType === "SERVICE" ? "Describe the work, location and timing you need." : "Describe the gift, customization and delivery timing you need."} /></label>}
      <label className="font-semibold text-brand-dark">What do you need? <span aria-hidden="true">*</span><input name="title" autoFocus={embedded} required minLength={3} maxLength={160} value={values.title} onChange={event => change("title", event.target.value)} placeholder="e.g. A study desk for my home office" /></label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="font-semibold text-brand-dark">Category <span aria-hidden="true">*</span>{values.requestType === "PRODUCT" && categories.length ? <select name="category" required disabled={lockKeyFields} value={values.category} onChange={event => change("category", event.target.value)}><option value="">Choose a category</option>{categories.map(category => <option key={category}>{category}</option>)}{values.category && !categories.includes(values.category) && <option>{values.category}</option>}</select> : <input name="category" required readOnly={lockKeyFields} maxLength={100} value={values.category} onChange={event => change("category", event.target.value)} placeholder={values.requestType === "SERVICE" ? "e.g. AC Repair" : values.requestType === "GIFT" ? "e.g. Birthday Gifts" : "Product category"} />}</label>
        <label className="font-semibold text-brand-dark">City <span aria-hidden="true">*</span><PakistanCitySelect name="city" aria-label="City" required maxLength={100} value={values.city} onValueChange={value => change("city", value)} /></label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="font-semibold text-brand-dark">Quantity <span aria-hidden="true">*</span><input name="quantity" type="number" min={1} max={10000} step={1} required value={values.quantity} onChange={event => change("quantity", event.target.value)} /></label>
      </div>
      <div className="rounded-2xl border border-emerald-100 bg-[#f8fbf1] p-4">
        <label className="!flex cursor-pointer items-center gap-2.5 font-semibold text-brand-dark"><input name="budgetFlexible" type="checkbox" checked={values.flexible} onChange={event => change("flexible", event.target.checked)} className="!h-4 !w-4 accent-emerald-800" /> My budget is flexible</label>
        {!values.flexible && <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="font-medium">Minimum budget (PKR)<input name="min" type="number" min={0} max={9999999999} step={1} inputMode="numeric" value={values.min} onKeyDown={blockNonDigitKeys} onChange={event => change("min", wholeNumber(event.target.value))} placeholder="Optional" /></label><label className="font-medium">Maximum budget (PKR) <span aria-hidden="true">*</span><input name="max" type="number" min={1} max={9999999999} step={1} inputMode="numeric" required value={values.max} onKeyDown={blockNonDigitKeys} onChange={event => change("max", wholeNumber(event.target.value))} placeholder="Your budget" /></label></div>}
      </div>
      <details ref={moreDetails} className="rounded-2xl border border-emerald-100 p-4" onInvalidCapture={() => { if (moreDetails.current) moreDetails.current.open = true; }}>
        <summary className="cursor-pointer rounded-md font-bold text-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">Add More Details</summary>
        <div className="mt-4 space-y-5">
          {values.requestType === "PRODUCT" && <label className="font-semibold text-brand-dark">Description <span className="font-normal text-neutral-500">(optional)</span><textarea name="description" maxLength={5000} rows={3} value={values.description} onChange={event => change("description", event.target.value)} placeholder="Add the size, brand, colour, or any other details that matter." /></label>}
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="font-semibold text-brand-dark">Condition<select name="condition" value={values.condition} onChange={event => change("condition", event.target.value as WantValues["condition"])}><option>Any</option><option>New</option><option>Used</option><option>Refurbished</option></select></label>
            <label className="font-semibold text-brand-dark">Need by <span className="font-normal text-neutral-500">(optional)</span><input name="needBy" type="date" min={dateAfter(1)} max={dateAfter(30)} value={values.needBy} onChange={event => change("needBy", event.target.value)} /></label>
          </div>
        </div>
      </details>
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2"><p className="font-bold text-brand-dark">Reference images</p><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Optional</span></div>
          <span className="shrink-0 text-sm tabular-nums text-neutral-500" aria-label={`${photos.length} of ${MAX_WANT_PHOTOS} images added`}>{photos.length} / {MAX_WANT_PHOTOS}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-neutral-500">Upload up to {MAX_WANT_PHOTOS} JPG, PNG, or WebP images (5 MB each), or paste an image with Ctrl+V.</p>
        {/* display:none input opened by ref: a focusable sr-only input made the browser scroll the dialog to reach it. */}
        <input id={`${id}-photo`} ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden tabIndex={-1} onChange={photoSelected} />
        {photos.length > 0 && <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((photo, index) => <li key={photo.key} className="relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt={`Reference image ${index + 1}`} className="h-full w-full object-cover" />
            {index === 0 && <span className="absolute bottom-1 left-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-emerald-900">Cover</span>}
            <button type="button" onClick={() => removePhoto(photo.key)} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-brand-dark shadow-sm hover:bg-neutral-100" aria-label={`Remove reference image ${index + 1}`}><X size={15} aria-hidden="true" /></button>
          </li>)}
        </ul>}
        {photos.length < MAX_WANT_PHOTOS && <button
          type="button" onClick={openPhotoPicker} aria-controls={`${id}-photo`}
          onDragEnter={event => { event.preventDefault(); setDragging(true); }}
          onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
          onDrop={event => { event.preventDefault(); setDragging(false); addPhotos(Array.from(event.dataTransfer.files)); }}
          className={`mt-3 flex w-full min-w-0 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 sm:py-7 ${dragging ? "border-emerald-500 bg-emerald-50" : "border-emerald-200 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50/80"}`}
        >
          <span className="relative mb-2 inline-flex text-brand-dark" aria-hidden="true">
            <ImageIcon size={34} strokeWidth={1.75} />
            <span className="absolute -right-2 -top-2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-700 text-white ring-2 ring-white"><Plus size={12} strokeWidth={3} /></span>
          </span>
          <span className="block text-base font-bold text-brand-dark">{photos.length ? "Add more images" : "Add images"}</span>
          <span className="mt-0.5 block text-sm text-neutral-600">Drag files here or <span className="font-semibold text-emerald-700 underline decoration-dashed underline-offset-4">browse</span></span>
          <span className="mt-2 block text-xs text-neutral-500">Supports JPG, PNG, WebP · Max 5 MB each · Up to {MAX_WANT_PHOTOS} images</span>
        </button>}
        {photoError && <p role="alert" className="mt-2 text-sm text-red-700">{photoError}</p>}
      </div>
    </fieldset>
    <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/70 px-3 py-3 sm:gap-4 sm:px-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true"><ShieldCheck size={22} strokeWidth={2} /></span>
      <span className="h-9 w-px shrink-0 bg-emerald-200" aria-hidden="true" />
      <div className="min-w-0 text-sm leading-snug">
        <p className="font-semibold text-brand-dark">{editWant ? "Your changes are reviewed again before the post goes public." : "Your Want is reviewed before it goes public and expires after 30 days."}</p>
        <p className="mt-0.5 text-neutral-500">Don&apos;t include your phone number, email, or private address.</p>
      </div>
    </div>
    {error && <div ref={errorMessage} tabIndex={-1} role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800 outline-none">{error}{!isCustomer && <LoadingLink href="/login?role=customer&mode=signin&callbackUrl=%2Fwants" target="_blank" rel="noopener noreferrer" className="mt-2 block font-bold underline">Sign in in a new tab, then retry here</LoadingLink>}</div>}
    {submitted && !onSuccess && <div role="status" className="rounded-xl bg-lime-50 p-4 text-emerald-900">{editWant ? "Your changes have been saved and sent for review." : "Your Want has been submitted for review."} <LoadingLink href={`/wants/${submitted.id}`} className="font-bold underline">View your Want</LoadingLink></div>}
    {!hideFooter && <LoadingButton type="submit" loading={busy} disabled={!!submitted} loadingLabel="Saving…" className="rounded-xl bg-brand-primary px-5 py-3 font-bold text-brand-dark disabled:opacity-50">{editWant ? "Save changes" : "Submit Want for review"}</LoadingButton>}
  </LoadingForm>;
}
