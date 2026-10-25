"use client";
import { blockNonDigitKeys, wholeNumber } from "@/lib/whole-number-input";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { LoadingLink } from "@/components/ui/LoadingLink";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { wantInput } from "@/lib/want-schema";
import { PakistanCitySelect } from "@/components/ui/PakistanCitySelect";

export type SubmittedWant = { id: string; status: string };
/** Existing Want loaded for editing; saving sends it back through moderation. */
export type EditableWant = { id: string; values: Partial<WantValues>; photo: string | null };
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
  const [photoFile, setPhotoFile] = useState<File | null>(null); const [preview, setPreview] = useState("");
  const [existingPhoto, setExistingPhoto] = useState(editWant?.photo || "");
  const [submitted, setSubmitted] = useState<SubmittedWant | null>(null);
  const fileInput = useRef<HTMLInputElement>(null); const lock = useRef(false); const completed = useRef(false);
  const moreDetails = useRef<HTMLDetailsElement>(null);
  const errorMessage = useRef<HTMLDivElement>(null);
  const uploadedPhoto = useRef<{ file: File; url: string } | null>(null);
  /** Scroll position of the enclosing scroll body while the native file picker is open. */
  const pickerScroll = useRef<{ body: HTMLElement; top: number } | null>(null);
  const hadCustomer = useRef(isCustomer); if (isCustomer) hadCustomer.current = true;
  const photoChanged = photoFile !== null || existingPhoto !== (editWant?.photo || "");
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
  useEffect(() => {
    if (!photoFile) { setPreview(""); return; }
    const url = URL.createObjectURL(photoFile); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);
  // Choosing (or cancelling) an image must never move the form; put the scroll body back where the user left it.
  useLayoutEffect(() => {
    const saved = pickerScroll.current; if (!saved) return;
    saved.body.scrollTop = saved.top; pickerScroll.current = null;
  }, [photoFile, existingPhoto, photoError]);
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
  function choosePhoto(file: File | null) {
    setPhotoError("");
    if (file && (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type.toLowerCase()) || file.size > 5 * 1024 * 1024)) {
      setPhotoError("Choose a JPG, PNG, or WebP image up to 5 MB.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    onDirtyChange?.(file !== null || !!editWant?.photo || JSON.stringify(values) !== JSON.stringify(initial.current));
    uploadedPhoto.current = null; setPhotoFile(file); setExistingPhoto("");
    if (!file && fileInput.current) fileInput.current.value = "";
  }
  function openPhotoPicker() {
    const body = fileInput.current?.closest<HTMLElement>("[data-want-scroll-body]");
    pickerScroll.current = body ? { body, top: body.scrollTop } : null;
    fileInput.current?.click();
  }
  function photoSelected(event: ChangeEvent<HTMLInputElement>) {
    choosePhoto(event.target.files?.[0] || null);
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
      let photo = uploadedPhoto.current?.file === photoFile ? uploadedPhoto.current.url : photoFile ? null : existingPhoto || null;
      if (photoFile && !photo) {
        const uploadData = new FormData(); uploadData.set("file", photoFile); uploadData.set("folder", "inrange-wants");
        const response = await fetch("/api/upload", { method: "POST", body: uploadData });
        const result = await response.json().catch(() => null);
        if (!response.ok || typeof result?.url !== "string") throw new Error(result?.error || "Could not upload the photo. Please try again.");
        photo = result.url; uploadedPhoto.current = { file: photoFile, url: result.url };
      }
      const response = await fetch(editWant ? `/api/wants/${editWant.id}` : "/api/wants", { method: editWant ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input.data, photo }) });
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
        <p className="font-semibold text-brand-dark">Reference image <span className="font-normal text-neutral-500">(optional)</span></p><p className="mt-1 text-sm text-neutral-500">JPG, PNG, or WebP. Maximum 5 MB.</p>
        {/* display:none input opened by ref: a focusable sr-only input made the browser scroll the dialog to reach it. */}
        <input id={`${id}-photo`} ref={fileInput} name="photo" type="file" accept="image/jpeg,image/png,image/webp" hidden tabIndex={-1} onChange={photoSelected} />
        <button type="button" onClick={openPhotoPicker} aria-controls={`${id}-photo`} className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-4 font-semibold text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"><ImagePlus size={20} aria-hidden="true" />{photoFile || existingPhoto ? "Change image" : "Add an image"}</button>
        {(preview || existingPhoto) && <div className="relative mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview || existingPhoto} alt="Your selected reference" className="block h-[140px] w-full max-w-full object-contain sm:h-[180px]" />
          <button type="button" onClick={() => choosePhoto(null)} className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-bold text-brand-dark shadow-sm hover:bg-neutral-100" aria-label="Remove reference image"><X size={16} aria-hidden="true" />Remove</button><p className="truncate border-t border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">{photoFile?.name || "Current image"}</p>
        </div>}
        {photoError && <p role="alert" className="mt-2 text-sm text-red-700">{photoError}</p>}
      </div>
    </fieldset>
    <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-600">{editWant ? "Your changes will be reviewed again before the post is public." : "Your Want will be reviewed before it becomes public and expires after 30 days."} Keep your phone number, email, and private address out of the post.</p>
    {error && <div ref={errorMessage} tabIndex={-1} role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800 outline-none">{error}{!isCustomer && <LoadingLink href="/login?role=customer&mode=signin&callbackUrl=%2Fwants" target="_blank" rel="noopener noreferrer" className="mt-2 block font-bold underline">Sign in in a new tab, then retry here</LoadingLink>}</div>}
    {submitted && !onSuccess && <div role="status" className="rounded-xl bg-lime-50 p-4 text-emerald-900">{editWant ? "Your changes have been saved and sent for review." : "Your Want has been submitted for review."} <LoadingLink href={`/wants/${submitted.id}`} className="font-bold underline">View your Want</LoadingLink></div>}
    {!hideFooter && <LoadingButton type="submit" loading={busy} disabled={!!submitted} loadingLabel="Saving…" className="rounded-xl bg-brand-primary px-5 py-3 font-bold text-brand-dark disabled:opacity-50">{editWant ? "Save changes" : "Submit Want for review"}</LoadingButton>}
  </LoadingForm>;
}
