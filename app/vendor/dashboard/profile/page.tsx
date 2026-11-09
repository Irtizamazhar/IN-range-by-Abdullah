"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { PakistanCitySelect } from "@/components/ui/PakistanCitySelect";
import Link from "@/components/ui/LoadingLink";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Circle, CircleCheck, ExternalLink, Gauge, Info, Loader2, MapPin, Store, Trash2, Upload, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { fetchShopCategoryNameList } from "@/lib/shop-category-names";

type Profile = { id: string; status: string; shopName: string; storeSlug: string | null; shopDescription: string | null; primaryCategory: string; shopLogo: string | null; storeBanner: string | null; city: string; address: string; productCount: number };
type Values = { shopName: string; shopDescription: string; primaryCategory: string; shopLogo: string; storeBanner: string };
type ImageKind = "shopLogo" | "storeBanner";
type LocationRequest = { status: "PENDING" | "APPROVED" | "REJECTED"; city: string; address: string; ticketNumber: string; ticketHref: string; requestedAt: string; reviewedAt: string | null; reviewNote: string | null };
type UploadState = { progress: number | null; done: boolean; error: string; warning: string };

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const SPECS: Record<ImageKind, { title: string; size: string; minWidth: number; minHeight: number; ratio: number }> = {
  shopLogo: { title: "Profile Photo (Logo)", size: "512 × 512 px (min 400 × 400), square", minWidth: 400, minHeight: 400, ratio: 1 },
  storeBanner: { title: "Store Banner", size: "1800 × 600 px (min 1200 × 400), 3:1", minWidth: 1200, minHeight: 400, ratio: 3 },
};
const emptyUpload: UploadState = { progress: null, done: false, error: "", warning: "" };
const card = "rounded-2xl border border-[#e3ede6] bg-white p-5 shadow-[0_6px_20px_rgba(11,60,36,0.05)] sm:p-6";
const inputClass = "mt-1.5 w-full min-w-0 rounded-xl border border-[#d5e3dc] bg-white px-4 py-3 text-sm text-darkText outline-none transition focus:border-[#0f5c3e] focus:ring-2 focus:ring-[#0f5c3e]/15 aria-[invalid=true]:border-red-500";

function toValues(profile: Profile): Values {
  return {
    shopName: profile.shopName || "", shopDescription: profile.shopDescription || "", primaryCategory: profile.primaryCategory || "",
    shopLogo: profile.shopLogo || "", storeBanner: profile.storeBanner || "",
  };
}

/** Uses XHR (not fetch) so the existing upload endpoint can report real progress. */
function uploadWithProgress(file: File, onProgress: (percent: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/vendor/upload");
    xhr.withCredentials = true;
    xhr.timeout = 60000;
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    xhr.onload = () => {
      let data: { url?: string; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON proxy error */ }
      if (xhr.status === 401 || xhr.status === 403) reject(new Error("Your session has expired or your store is not approved. Sign in again."));
      else if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data.url);
      else reject(new Error(data.error || "Upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Please try again."));
    const body = new FormData();
    body.set("file", file);
    xhr.send(body);
  });
}

function imageSize(file: File) {
  return new Promise<{ width: number; height: number } | null>(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

export default function VendorProfilePage() {
  const router = useLoadingRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState<Record<ImageKind, UploadState>>({ shopLogo: emptyUpload, storeBanner: emptyUpload });
  const [preview, setPreview] = useState<ImageKind | null>(null);
  const [locationRequest, setLocationRequest] = useState<LocationRequest | null>(null);
  const fileInputs = useRef<Record<ImageKind, HTMLInputElement | null>>({ shopLogo: null, storeBanner: null });
  const saveLock = useRef(false);

  const load = useCallback(async (signal?: { aborted: boolean }) => {
    try {
      const response = await fetch("/api/vendor/profile", { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as { profile?: Profile; locationRequest?: LocationRequest | null; error?: string };
      if (response.status === 401) throw new Error("Sign in with an approved seller account to edit your profile.");
      if (!response.ok || !data.profile) throw new Error(data.error || "Could not load your profile.");
      setProfile(data.profile); setValues(toValues(data.profile)); setLocationRequest(data.locationRequest || null); setLoadError("");
    } catch (error) { if (!signal?.aborted) setLoadError(error instanceof Error ? error.message : "Could not load your profile."); }
  }, []);
  // A plain "cancelled" flag instead of AbortController: aborting the request on unmount (React Strict
  // Mode runs effects twice in development) surfaced "AbortError: signal is aborted without reason".
  useEffect(() => { const status = { aborted: false }; void load(status); return () => { status.aborted = true; }; }, [load]);
  useEffect(() => { void fetchShopCategoryNameList().then(setCategories); }, []);

  const dirty = useMemo(() => Boolean(profile && values && JSON.stringify(values) !== JSON.stringify(toValues(profile))), [profile, values]);
  const uploading = uploads.shopLogo.progress !== null || uploads.storeBanner.progress !== null;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues(current => current ? { ...current, [key]: value } : current);
    setErrors(e => ({ ...e, [key]: "" }));
  }

  async function chooseImage(kind: ImageKind, file: File | undefined) {
    if (!file || uploads[kind].progress !== null) return;
    if (!TYPES.includes(file.type)) { setUploads(u => ({ ...u, [kind]: { ...emptyUpload, error: "Use a JPG, PNG or WebP image." } })); return; }
    if (file.size > MAX_BYTES) { setUploads(u => ({ ...u, [kind]: { ...emptyUpload, error: "The image must be 5MB or smaller." } })); return; }
    const spec = SPECS[kind];
    const size = await imageSize(file);
    const warning = size && (size.width < spec.minWidth || size.height < spec.minHeight)
      ? `This image is ${size.width} × ${size.height} px and may look blurry. Recommended: ${spec.size}.`
      : size && Math.abs(size.width / size.height - spec.ratio) > spec.ratio * 0.15 ? `Parts of this image will be cropped. Best fit: ${spec.size}.` : "";
    setUploads(u => ({ ...u, [kind]: { ...emptyUpload, progress: 0 } }));
    try {
      const url = await uploadWithProgress(file, progress => setUploads(u => ({ ...u, [kind]: { ...u[kind], progress } })));
      set(kind, url);
      setUploads(u => ({ ...u, [kind]: { progress: null, done: true, error: "", warning } }));
    } catch (error) {
      setUploads(u => ({ ...u, [kind]: { ...emptyUpload, error: error instanceof Error ? error.message : "Upload failed. Please try again." } }));
    }
  }
  function removeImage(kind: ImageKind) {
    // Only clears this store's reference; the stored file is never deleted, so other records keep working.
    set(kind, "");
    setUploads(u => ({ ...u, [kind]: emptyUpload }));
  }

  function cancel() {
    if (!profile) return;
    setValues(toValues(profile)); setErrors({}); setUploads({ shopLogo: emptyUpload, storeBanner: emptyUpload });
  }

  async function save() {
    if (!values || saveLock.current || uploading) return;
    const clientErrors: Record<string, string> = {};
    if (!values.shopName.trim()) clientErrors.shopName = "Store name is required.";
    if (!values.primaryCategory.trim()) clientErrors.primaryCategory = "Choose a category.";
    if (Object.keys(clientErrors).length) { setErrors(clientErrors); toast.error("Please fix the highlighted fields."); focusError(clientErrors); return; }
    saveLock.current = true; setSaving(true);
    try {
      const response = await fetch("/api/vendor/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify(values),
      });
      const data = await response.json().catch(() => ({})) as { profile?: Profile; error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok || !data.profile) {
        if (data.fieldErrors) { setErrors(data.fieldErrors); focusError(data.fieldErrors); }
        throw new Error(response.status === 401 ? "Your session has expired. Sign in again; your changes are still on this page." : data.error || "Could not save your profile.");
      }
      setProfile(data.profile); setValues(toValues(data.profile)); setErrors({});
      setUploads({ shopLogo: emptyUpload, storeBanner: emptyUpload });
      toast.success("Profile saved. Your public store is updated.");
      // Re-render the dashboard layout so the top bar shows the new logo straight away.
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally { saveLock.current = false; setSaving(false); }
  }
  function focusError(fieldErrors: Record<string, string>) {
    const key = Object.keys(fieldErrors).find(k => fieldErrors[k]);
    const node = key ? document.getElementById(`pf-${key.replace(".", "-")}`) : null;
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    node?.focus({ preventScroll: true });
  }

  if (loadError) return <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><p role="alert" className="rounded-2xl bg-white p-6 text-darkText shadow-card">{loadError}</p><LoadingButton onClick={() => load()} className="mt-4 rounded-xl bg-brand-primary px-4 py-2 font-bold">Retry</LoadingButton></main>;
  if (!profile || !values) return <PageSkeleton label="Loading your profile…" />;

  const storePath = `/stores/${encodeURIComponent(profile.storeSlug || profile.id)}`;
  const categoryOptions = values.primaryCategory && !categories.includes(values.primaryCategory) ? [values.primaryCategory, ...categories] : categories;
  const actions = (where: "top" | "bottom") => <div className={where === "top" ? "hidden items-center gap-3 sm:flex" : "flex gap-3 sm:hidden"}>
    <button type="button" onClick={cancel} disabled={!dirty || saving} className="min-h-11 flex-1 whitespace-nowrap rounded-full border border-[#d5e3dc] bg-white px-5 text-sm font-semibold text-[#0f5c3e] hover:bg-[#f3f8f5] disabled:opacity-50">Cancel</button>
    <LoadingButton type="button" onClick={save} loading={saving} loadingLabel="Saving…" disabled={!dirty || uploading} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#0f5c3e] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#0b4a31] disabled:opacity-50"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4" aria-hidden />Save Changes</span></LoadingButton>
  </div>;

  return <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pb-10 sm:pt-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e6f4dc] text-[#0f5c3e]"><UserRound className="h-6 w-6" aria-hidden /></span>
        <div><h1 className="text-2xl font-bold text-darkText sm:text-[1.7rem]">Profile Settings</h1><p className="text-sm text-darkText/60">Update your store profile, banner and public information.</p></div>
      </div>
      {actions("top")}
    </header>
    {dirty && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900"><Info className="h-4 w-4 shrink-0" aria-hidden />You have unsaved changes. Save to update your public store.</p>}

    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
      <ImageCard kind="shopLogo" value={values.shopLogo} state={uploads.shopLogo} fallback={values.shopName.slice(0, 2).toUpperCase() || "ST"} onPick={() => fileInputs.current.shopLogo?.click()} onRemove={() => removeImage("shopLogo")} onPreview={() => setPreview("shopLogo")} />
      <ImageCard kind="storeBanner" value={values.storeBanner} state={uploads.storeBanner} fallback="" onPick={() => fileInputs.current.storeBanner?.click()} onRemove={() => removeImage("storeBanner")} onPreview={() => setPreview("storeBanner")} />
      {(["shopLogo", "storeBanner"] as const).map(kind => <input key={kind} ref={node => { fileInputs.current[kind] = node; }} type="file" accept={TYPES.join(",")} className="sr-only" tabIndex={-1} aria-label={`Upload ${SPECS[kind].title}`} onChange={event => { void chooseImage(kind, event.target.files?.[0]); event.target.value = ""; }} />)}
    </div>

    <section className={`${card} mt-5`} aria-labelledby="pf-info-title">
      <SectionTitle id="pf-info-title" icon={<Store className="h-5 w-5" aria-hidden />} title="Store Information" />
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Field id="shopName" label="Store name" error={errors.shopName}><input id="pf-shopName" className={inputClass} value={values.shopName} maxLength={160} aria-invalid={Boolean(errors.shopName) || undefined} onChange={e => set("shopName", e.target.value)} /></Field>
        <Field id="primaryCategory" label="Primary category" error={errors.primaryCategory}><select id="pf-primaryCategory" className={inputClass} value={values.primaryCategory} aria-invalid={Boolean(errors.primaryCategory) || undefined} onChange={e => set("primaryCategory", e.target.value)}><option value="">{categories.length ? "Select category" : "Loading…"}</option>{categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field id="shopDescription" label="Store description" error={errors.shopDescription} className="md:col-span-2" hint={`${values.shopDescription.length}/5000`}><textarea id="pf-shopDescription" className={`${inputClass} min-h-28 resize-y`} value={values.shopDescription} maxLength={5000} onChange={e => set("shopDescription", e.target.value)} placeholder="Tell customers what you sell and why they should shop with you." /></Field>
      </div>
    </section>

    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
      <section className={card} aria-labelledby="pf-location-title">
        <SectionTitle id="pf-location-title" icon={<MapPin className="h-5 w-5" aria-hidden />} title="Location" />
        <dl className="mt-5 space-y-4 text-sm">
          <div><dt className="font-semibold text-darkText">Registered city</dt><dd className="mt-1 rounded-xl bg-[#f4f8f5] px-4 py-3 text-darkText/80">{profile.city || "Not set"}</dd></div>
          <div><dt className="font-semibold text-darkText">Registered address</dt><dd className="mt-1 whitespace-pre-line break-words rounded-xl bg-[#f4f8f5] px-4 py-3 text-darkText/80">{profile.address || "Not set"}</dd></div>
        </dl>
        <LocationChange request={locationRequest} onSubmitted={setLocationRequest} />
        <p className="mt-4 text-xs leading-5 text-darkText/55">Location changes are checked by the JORO team before they go live. Service cities are managed in <Link href="/vendor/dashboard/store" className="font-semibold text-[#0f5c3e] underline">Store &amp; QR</Link>.</p>
      </section>

      <StoreStrength values={values} productCount={profile.productCount} storePath={storePath} />
    </div>

    <div className="mt-6 hidden items-center justify-end gap-3 sm:flex">
      {actions("top")}
    </div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e3ede6] bg-white/95 px-4 py-3 backdrop-blur sm:hidden">{actions("bottom")}</div>

    {preview && values[preview] && <ImageLightbox images={[values[preview]]} title={SPECS[preview].title} zoomable onClose={() => setPreview(null)} />}
  </main>;
}

/** How complete the storefront is, from the values on screen; every tip keeps customers on JORO. */
function StoreStrength({ values, productCount, storePath }: { values: Values; productCount: number; storePath: string }) {
  const description = values.shopDescription.trim().length;
  const items = [
    { done: Boolean(values.shopLogo), label: "Add a store logo", hint: "Customers recognise you faster." },
    { done: Boolean(values.storeBanner), label: "Add a store banner", hint: "Makes your store page stand out." },
    { done: description >= 80, label: "Write a store description", hint: description ? `${description}/80 characters` : "At least 80 characters about what you sell." },
    { done: Boolean(values.primaryCategory) && values.primaryCategory !== "Other", label: "Choose your main category", hint: "Helps buyers find you in the right place." },
    { done: productCount >= 5, label: "List at least 5 products", hint: `${productCount} listed so far`, href: "/vendor/dashboard/products" },
  ];
  const score = Math.round((items.filter(item => item.done).length / items.length) * 100);
  const tone = score === 100 ? "bg-[#2f8a3a]" : score >= 60 ? "bg-[#0f5c3e]" : "bg-amber-500";
  return <section className={card} aria-labelledby="pf-strength-title">
    <SectionTitle id="pf-strength-title" icon={<Gauge className="h-5 w-5" aria-hidden />} title="Store Strength" />
    <div className="mt-5 flex items-end justify-between gap-3">
      <p className="text-3xl font-bold text-darkText">{score}%</p>
      <p className="pb-1 text-xs font-semibold text-darkText/55">{score === 100 ? "Your store looks complete" : "Complete your store to win more buyers"}</p>
    </div>
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e3ede6]" role="progressbar" aria-label="Store strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
      <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${score}%` }} />
    </div>
    <ul className="mt-5 space-y-3">
      {items.map(item => <li key={item.label} className="flex items-start gap-3">
        {item.done ? <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#2f8a3a]" aria-hidden /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-darkText/25" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold ${item.done ? "text-darkText/55 line-through decoration-darkText/30" : "text-darkText"}`}>{item.label}<span className="sr-only">{item.done ? " (done)" : " (to do)"}</span></span>
          <span className="block text-xs text-darkText/55">{item.hint}</span>
        </span>
        {!item.done && item.href && <Link href={item.href} className="shrink-0 text-xs font-semibold text-[#0f5c3e] underline">Add</Link>}
      </li>)}
    </ul>
    <a href={storePath} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0f5c3e] px-4 text-sm font-semibold text-[#0f5c3e] hover:bg-[#f3f8f5]"><ExternalLink className="h-4 w-4" aria-hidden />See how customers see your store</a>
  </section>;
}

/** Request form + status for changing the verified city/address; an admin approves before anything changes. */
function LocationChange({ request, onSubmitted }: { request: LocationRequest | null; onSubmitted: (request: LocationRequest) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ city: "", address: "", reason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const pending = request?.status === "PENDING";

  async function submit() {
    if (sending) return;
    const next: Record<string, string> = {};
    if (form.city.trim().length < 2) next.city = "Enter the new city.";
    if (form.address.trim().length < 5) next.address = "Enter the full new address.";
    if (form.reason.trim().length < 5) next.reason = "Tell us briefly why the location is changing.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSending(true);
    try {
      const response = await fetch("/api/vendor/profile/location-request", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ city: form.city.trim(), address: form.address.trim(), reason: form.reason.trim() }) });
      const data = await response.json().catch(() => ({})) as { locationRequest?: LocationRequest; error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok || !data.locationRequest) { if (data.fieldErrors) setErrors(data.fieldErrors); throw new Error(response.status === 401 ? "Your session has expired. Sign in again." : data.error || "Could not send your request."); }
      onSubmitted(data.locationRequest); setOpen(false); setForm({ city: "", address: "", reason: "" });
      toast.success("Request sent. We'll review it and let you know.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not send your request."); }
    finally { setSending(false); }
  }

  const fieldClass = "mt-1.5 w-full min-w-0 rounded-xl border border-[#d5e3dc] bg-white px-4 py-3 text-sm text-darkText outline-none focus:border-[#0f5c3e] focus:ring-2 focus:ring-[#0f5c3e]/15 aria-[invalid=true]:border-red-500";
  return <div className="mt-4">
    {pending && request ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold">Change under review</p>
      <p className="mt-1 break-words">New location: {request.address}, {request.city}</p>
      <Link href={request.ticketHref} className="mt-1 inline-block text-xs font-semibold text-[#0f5c3e] underline">View ticket {request.ticketNumber}</Link>
    </div> : <>
      {request?.status === "REJECTED" && <p role="status" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Your last request was not approved{request.reviewNote ? `: ${request.reviewNote}` : "."}</p>}
      {request?.status === "APPROVED" && !open && <p role="status" className="mb-3 flex items-center gap-2 rounded-xl bg-[#e9f5ee] px-4 py-3 text-sm text-[#0f5c3e]"><CircleCheck className="h-4 w-4 shrink-0" aria-hidden />Your last location change was approved.</p>}
      {!open ? <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0f5c3e] bg-white px-4 text-sm font-semibold text-[#0f5c3e] hover:bg-[#f3f8f5]"><MapPin className="h-4 w-4" aria-hidden />Request change</button>
        : <div className="space-y-3 rounded-xl border border-[#e3ede6] p-4">
          <div><label htmlFor="lc-city" className="text-sm font-semibold text-darkText">New city</label>
            <PakistanCitySelect id="lc-city" aria-label="New city" aria-invalid={Boolean(errors.city) || undefined} value={form.city} onValueChange={city => { setForm(f => ({ ...f, city })); setErrors(e => ({ ...e, city: "" })); }} wrapperClassName="mt-1.5" className="!border-[#d5e3dc]" />
            {errors.city && <p className="mt-1 text-xs font-medium text-red-700">{errors.city}</p>}</div>
          <div><label htmlFor="lc-address" className="text-sm font-semibold text-darkText">New address</label>
            <textarea id="lc-address" rows={2} maxLength={2000} className={fieldClass} aria-invalid={Boolean(errors.address) || undefined} value={form.address} onChange={e => { setForm(f => ({ ...f, address: e.target.value })); setErrors(er => ({ ...er, address: "" })); }} placeholder="Shop / building, street, area" />
            {errors.address && <p className="mt-1 text-xs font-medium text-red-700">{errors.address}</p>}</div>
          <div><label htmlFor="lc-reason" className="text-sm font-semibold text-darkText">Reason</label>
            <input id="lc-reason" maxLength={1000} className={fieldClass} aria-invalid={Boolean(errors.reason) || undefined} value={form.reason} onChange={e => { setForm(f => ({ ...f, reason: e.target.value })); setErrors(er => ({ ...er, reason: "" })); }} placeholder="e.g. Shop moved to a new market" />
            {errors.reason && <p className="mt-1 text-xs font-medium text-red-700">{errors.reason}</p>}</div>
          <div className="flex flex-wrap gap-2">
            <LoadingButton type="button" onClick={submit} loading={sending} loadingLabel="Sending…" className="inline-flex min-h-10 items-center rounded-full bg-[#0f5c3e] px-4 text-sm font-semibold text-white hover:bg-[#0b4a31]">Send request</LoadingButton>
            <button type="button" onClick={() => { setOpen(false); setErrors({}); }} disabled={sending} className="min-h-10 rounded-full border border-[#d5e3dc] px-4 text-sm font-semibold text-darkText/70">Cancel</button>
          </div>
        </div>}
    </>}
  </div>;
}

function SectionTitle({ id, icon, title }: { id: string; icon: ReactNode; title: string }) {
  return <h2 id={id} className="flex items-center gap-2.5 text-lg font-bold text-darkText"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f4dc] text-[#0f5c3e]">{icon}</span>{title}</h2>;
}

function Field({ id, label, error, hint, className = "", children }: { id: string; label: string; error?: string; hint?: string; className?: string; children: ReactNode }) {
  return <div className={`min-w-0 ${className}`}>
    <label htmlFor={`pf-${id}`} className="flex items-center justify-between gap-2 text-sm font-semibold text-darkText">{label}{hint && <span className="text-xs font-normal text-darkText/45">{hint}</span>}</label>
    {children}
    {error && <p className="mt-1 text-xs font-medium text-red-700">{error}</p>}
  </div>;
}

function ImageCard({ kind, value, state, fallback, onPick, onRemove, onPreview }: { kind: ImageKind; value: string; state: UploadState; fallback: string; onPick: () => void; onRemove: () => void; onPreview: () => void }) {
  const spec = SPECS[kind];
  const isLogo = kind === "shopLogo";
  const busy = state.progress !== null;
  const media = value
    ? <button type="button" onClick={onPreview} aria-label={`Preview ${spec.title}`} className={isLogo ? "relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-white bg-[#e6f4dc] shadow-[0_8px_22px_rgba(12,66,38,0.15)] sm:h-32 sm:w-32" : "relative block aspect-[3/1] w-full overflow-hidden rounded-xl border border-[#e3ede6] bg-[#f4f8f5]"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={value} alt="" className={`h-full w-full ${isLogo ? "object-cover" : "object-contain"}`} />
      {busy && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-6 w-6 animate-spin text-[#0f5c3e]" aria-hidden /></span>}
    </button>
    : <div className={isLogo ? "flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#0f5c3e] text-3xl font-bold text-white shadow-[0_8px_22px_rgba(12,66,38,0.15)] sm:h-32 sm:w-32" : "flex aspect-[3/1] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#c9dccf] bg-gradient-to-r from-[#eaf8dc] to-[#e3f6cf] text-sm text-[#0f5c3e]"}>
      {busy ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : isLogo ? fallback : <><Upload className="h-5 w-5" aria-hidden />No banner yet</>}
    </div>;
  return <section className={card} aria-labelledby={`pf-${kind}-title`}>
    <div className={isLogo ? "flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left" : "flex flex-col gap-4"}>
      {isLogo && media}
      <div className="min-w-0 flex-1">
        <h2 id={`pf-${kind}-title`} className="text-base font-bold text-darkText">{spec.title}</h2>
        <p className="mt-1 text-xs leading-5 text-darkText/55">Recommended: {spec.size}<br />JPG, PNG or WebP · max 5MB</p>
        {!isLogo && <div className="mt-3">{media}</div>}
        <div role="status" aria-live="polite" className="mt-3 min-h-5 text-xs">
          {busy ? <span className="flex items-center gap-2 font-semibold text-[#0f5c3e]">Uploading… {state.progress}%<span className="h-1.5 w-28 overflow-hidden rounded-full bg-[#e3ede6]"><span className="block h-full rounded-full bg-[#0f5c3e] transition-all" style={{ width: `${state.progress}%` }} /></span></span>
            : state.done ? <span className="flex items-center gap-1.5 font-semibold text-[#2f8a3a]"><CircleCheck className="h-4 w-4" aria-hidden />Uploaded — save changes to publish</span>
            : null}
          {state.warning && !busy && <span className="mt-1 block text-amber-700">{state.warning}</span>}
          {state.error && <span role="alert" className="block font-medium text-red-700">{state.error}</span>}
        </div>
        <div className={`mt-3 flex flex-wrap gap-2 ${isLogo ? "justify-center sm:justify-start" : ""}`}>
          <button type="button" onClick={onPick} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0f5c3e] bg-white px-4 text-sm font-semibold text-[#0f5c3e] hover:bg-[#f3f8f5] disabled:opacity-50"><Upload className="h-4 w-4" aria-hidden />{value ? "Replace" : "Upload New"}</button>
          {value && <button type="button" onClick={onRemove} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden />Remove</button>}
        </div>
      </div>
    </div>
  </section>;
}
