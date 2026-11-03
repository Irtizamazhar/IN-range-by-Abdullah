"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "@/components/ui/LoadingLink";
import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import { LogoMark } from "@/components/user/LogoMark";
import { CnicInput } from "@/components/ui/CnicInput";
import { PakistanMobileInput } from "@/components/ui/PakistanMobileInput";
import { PakistanCitySelect } from "@/components/ui/PakistanCitySelect";
import { ArrowRight, Check, ChevronLeft, ClipboardCheck, IdCard, Landmark, Store, Truck, Upload } from "lucide-react";
import { normalizePakistanMobile, formatPakistanMobileInput } from "@/lib/pakistan-phone";
import { PAKISTAN_BANK_OPTIONS } from "@/lib/pakistan-banks";
import { PAKISTAN_PROVINCES, provinceForCity } from "@/lib/pakistan-city-province";
import { fetchShopCategoryNameList } from "@/lib/shop-category-names";
import { vendorSetupSchema, setupStepErrors, SETUP_STEP_KEYS } from "@/lib/vendor-onboarding-schema";

const SAVE_TIMEOUT_MS = 30000;
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const DOC_TYPES = ["image/png", "image/jpeg", "image/webp"];
const STEPS = [
  { label: "Business", title: "Business Info", icon: Store },
  { label: "Identity", title: "Verify Identity", icon: IdCard },
  { label: "Pickup", title: "Pickup & Return", icon: Truck },
  { label: "Payout", title: "Payout Details", icon: Landmark },
  { label: "Review", title: "Review & Submit", icon: ClipboardCheck },
] as const;
const SENT_KEYS = [...SETUP_STEP_KEYS.flat().filter(key => key !== "storeSlug"), "declarationAccepted"];
const DOC_LABELS: Record<string, string> = { cnic_front: "Front side", cnic_back: "Back side", license: "Registration document" };

type Values = Record<string, string | boolean>;
type Doc = { id: string; documentType: string };
type Toggles = { pickupFromShop: boolean; contactFromAccount: boolean };

const str = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const inputClass = "h-12 w-full min-w-0 rounded-xl border border-[#d5e3dc] bg-white px-3 text-[15px] font-normal text-[#12352a] outline-none transition placeholder:text-neutral-400 focus:border-[#0f5c3e] focus:ring-2 focus:ring-[#0f5c3e]/15 aria-[invalid=true]:border-red-500";
const requiredDocs = (values: Values) => (values.businessType === "company" ? ["cnic_front", "cnic_back", "license"] : ["cnic_front", "cnic_back"]);
const businessAddressComplete = (v: Values) => str(v.address).trim().length >= 5 && Boolean(str(v.city).trim()) && Boolean(str(v.province).trim());
const maskCnic = (cnic: string) => (cnic.length >= 13 ? `•••••-•••••••-${cnic.slice(-1)}` : "Not added");
const maskAccount = (account: string) => (account ? `•••• ${account.replace(/\s/g, "").slice(-4)}` : "Not added");

/** Apply the pickup switches so a copied address is always the current business address. */
function withPickupDefaults(values: Values, toggles: Toggles): Values {
  const next = { ...values };
  if (toggles.pickupFromShop) Object.assign(next, { pickupAddress: str(values.address), pickupCity: str(values.city), pickupProvince: str(values.province), pickupPostalCode: str(values.postalCode) });
  if (toggles.contactFromAccount) Object.assign(next, { pickupContactName: str(values.name), pickupPhone: str(values.phone) });
  return next;
}

function stepOfField(key: string) {
  if (key === "documents" || key === "declarationAccepted") return key === "documents" ? 1 : 4;
  const index = SETUP_STEP_KEYS.findIndex(keys => (keys as readonly string[]).includes(key));
  return index < 0 ? 4 : index;
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="min-h-dvh bg-[#f2f7f4] text-[#12352a]">{children}</main>;
}

export function VendorOnboardingForm() {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ businessType: "individual", returnSameAsPickup: true, declarationAccepted: false });
  const [toggles, setToggles] = useState<Toggles>({ pickupFromShop: true, contactFromAccount: true });
  const [current, setCurrent] = useState(0);
  const [fromReview, setFromReview] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [showPhone, setShowPhone] = useState(false);
  const [bankOther, setBankOther] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rejection, setRejection] = useState("");
  const saveLock = useRef(false);
  const pendingErrorFocus = useRef<string | null>(null);
  const pickupChosen = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const r = await fetch("/api/vendor/onboarding", { cache: "no-store", signal });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Could not load setup.");
      const v = data.vendor;
      const saved = (v.onboardingData && typeof v.onboardingData === "object" ? v.onboardingData : {}) as Record<string, unknown>;
      const loaded: Values = {};
      for (const [key, value] of Object.entries({ ...v, ...saved })) if (typeof value === "string" || typeof value === "boolean") loaded[key] = value;
      Object.assign(loaded, {
        name: str(v.ownerName), category: str(v.primaryCategory), cnic: str(v.cnic), businessRegNo: str(v.businessRegNo),
        shopDescription: str(v.shopDescription), iban: str(v.iban), bankName: str(v.bankName), businessType: v.businessType === "company" ? "company" : "individual",
        returnSameAsPickup: saved.returnSameAsPickup !== false && saved.returnSameAsPickup !== "false", declarationAccepted: false,
      });
      if (!str(loaded.province) && str(loaded.city)) loaded.province = provinceForCity(str(loaded.city));
      if (!str(loaded.accountTitle) && loaded.businessType === "individual") loaded.accountTitle = str(loaded.name);
      setValues(loaded);
      const pickupAddress = str(loaded.pickupAddress);
      pickupChosen.current = Boolean(pickupAddress);
      setToggles({
        pickupFromShop: pickupAddress ? pickupAddress === str(loaded.address) && str(loaded.pickupCity) === str(loaded.city) && str(loaded.pickupProvince) === str(loaded.province) : businessAddressComplete(loaded),
        contactFromAccount: str(loaded.pickupContactName) ? str(loaded.pickupContactName) === str(loaded.name) && str(loaded.pickupPhone) === str(loaded.phone) : true,
      });
      setShowPhone(!normalizePakistanMobile(str(loaded.phone)));
      setBankOther(Boolean(str(loaded.bankName)) && !(PAKISTAN_BANK_OPTIONS as readonly string[]).includes(str(loaded.bankName)));
      setDocs(Array.isArray(v.documents) ? v.documents : []);
      setCurrent(Math.max(0, Math.min(4, Number(saved.step) || 0)));
      setRejection(str(v.rejectionReason));
      setLoadError("");
    } catch (error) {
      if (!signal?.aborted) setLoadError(error instanceof Error ? error.message : "Could not load setup.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => { void fetchShopCategoryNameList().then(setCategories); }, []);
  useEffect(() => {
    const key = pendingErrorFocus.current;
    pendingErrorFocus.current = null;
    const node = key ? (document.getElementsByName(key)[0] as HTMLElement | undefined) || document.getElementById(`${key}-error`) : undefined;
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
    node?.focus({ preventScroll: true });
  }, [errors, current]);

  function reportErrors(next: Record<string, string>) {
    pendingErrorFocus.current = Object.keys(next).find(key => Boolean(next[key])) || null;
    setErrors(next);
  }
  function change(key: string, value: string | boolean) {
    const isCity = key === "city" || key.endsWith("City");
    setValues(v => ({ ...v, [key]: value, ...(isCity ? autoProvince(key, String(value), v) : {}) }));
    setErrors(e => ({ ...e, [key]: "", ...(isCity && provinceForCity(String(value)) ? { [provinceKeyFor(key)]: "" } : {}) }));
  }
  function provinceKeyFor(cityKey: string) {
    return cityKey === "city" ? "province" : cityKey.replace("City", "Province");
  }
  function autoProvince(cityKey: string, city: string, v: Values) {
    const provinceKey = provinceKeyFor(cityKey);
    const province = provinceForCity(city);
    return province && province !== v[provinceKey] ? { [provinceKey]: province } : {};
  }
  function chooseFile(type: string, file: File | undefined) {
    if (!file) return;
    if (!DOC_TYPES.includes(file.type) || file.size > MAX_DOC_BYTES) {
      setErrors(e => ({ ...e, [type]: "Use a JPG, PNG or WebP image under 5MB." }));
      return;
    }
    setFiles(f => ({ ...f, [type]: file }));
    setErrors(e => ({ ...e, [type]: "", documents: "" }));
  }

  function clientErrors(payload: Values, step: number) {
    const fieldErrors = setupStepErrors(payload, step);
    if (step === 1) for (const type of requiredDocs(payload)) if (!files[type] && !docs.some(doc => doc.documentType === type)) fieldErrors[type] = "Upload this side to continue.";
    return fieldErrors;
  }

  async function save(mode: "continue" | "draft" | "submit", next = current) {
    if (saveLock.current) return false;
    const payload = withPickupDefaults(values, toggles);
    setMessage("");
    setSaveError(false);
    const jumpToReview = mode === "continue" && fromReview;
    if (mode === "continue") {
      const fieldErrors = clientErrors(payload, current);
      if (Object.keys(fieldErrors).length) { reportErrors(fieldErrors); setSaveError(true); setMessage("Please fix the highlighted fields."); return false; }
      setErrors({});
    }
    if (mode === "submit") {
      const checked = vendorSetupSchema.safeParse(payload);
      if (!checked.success) {
        setErrors(Object.fromEntries(checked.error.issues.map(i => [String(i.path[0]), i.message])));
        setSaveError(true);
        setMessage("Some details need attention. Use Edit on the highlighted section.");
        return false;
      }
      setErrors({});
    }
    saveLock.current = true;
    setBusy(true);
    try {
      const form = new FormData();
      for (const key of SENT_KEYS) if (payload[key] !== undefined && payload[key] !== null) form.set(key, String(payload[key]));
      const target = jumpToReview ? 4 : next;
      form.set("step", String(target));
      // The server re-validates the step being left; a jump back to Review is saved as a draft after the client check.
      if (mode === "continue" && !jumpToReview) { form.set("intent", "continue"); form.set("currentStep", String(current)); }
      for (const [key, file] of Object.entries(files)) form.set(key, file);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
      let r: Response;
      let d: { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; documents?: Doc[] } | null;
      try {
        r = await fetch("/api/vendor/onboarding", { method: mode === "submit" ? "POST" : "PATCH", body: form, signal: controller.signal, credentials: "same-origin" });
        d = await r.json().catch(error => { if (controller.signal.aborted) throw error; return null; });
      } finally { clearTimeout(timeout); }
      if (!r.ok) {
        if (d?.fieldErrors) {
          if (mode === "submit") setErrors(d.fieldErrors);
          else reportErrors(d.fieldErrors);
        }
        if (r.status === 401) throw Error("Your session has expired. Sign in again to continue — your saved progress is kept.");
        throw Error(typeof d?.error === "string" ? d.error : "We couldn't save your details. Please try again.");
      }
      if (d?.ok !== true) throw Error("The server did not confirm your save. Please try again.");
      if (mode === "submit") { await router.push("/vendor/status"); return true; }
      if (d.documents) { setDocs(d.documents); setFiles({}); }
      setValues(payload);
      // A new seller's pickup default follows the business address they just entered.
      if (target === 2 && !pickupChosen.current) { pickupChosen.current = true; setToggles(t => ({ ...t, pickupFromShop: businessAddressComplete(payload) })); }
      setFromReview(false);
      setCurrent(target);
      if (mode === "draft" && next === current) setMessage("Progress saved.");
      return true;
    } catch (e) {
      setSaveError(true);
      setMessage(e instanceof Error && e.name === "AbortError" ? "Saving timed out. Your entries are still here — please try again." : e instanceof Error ? e.message : "Could not save. Please try again.");
      return false;
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  }

  async function saveAndExit() {
    if (await save("draft")) await router.push("/");
  }
  async function editStep(step: number) {
    if (await save("draft", step)) setFromReview(true);
  }

  function field(key: string, label: string, control: ReactNode, opts: { optional?: boolean; hint?: string; className?: string } = {}) {
    return <div key={key} className={"min-w-0 " + (opts.className || "")}>
      <label htmlFor={`f-${key}`} className="mb-1.5 block text-sm font-semibold text-[#12352a]">{label}{opts.optional ? <span className="font-normal text-neutral-500"> (optional)</span> : " *"}</label>
      {control}
      {opts.hint && !errors[key] && <p className="mt-1 text-xs text-neutral-500">{opts.hint}</p>}
      {errors[key] && <p id={`${key}-error`} className="mt-1 text-xs font-medium text-red-700">{errors[key]}</p>}
    </div>;
  }
  const common = (key: string) => ({ id: `f-${key}`, name: key, "aria-invalid": Boolean(errors[key]) || undefined, "aria-describedby": errors[key] ? `${key}-error` : undefined });
  const text = (key: string, label: string, opts: { optional?: boolean; placeholder?: string; max?: number; hint?: string; className?: string; autoComplete?: string } = {}) =>
    field(key, label, <input {...common(key)} className={inputClass} value={str(values[key])} maxLength={opts.max ?? 200} placeholder={opts.placeholder} autoComplete={opts.autoComplete} onChange={e => change(key, e.target.value)} />, opts);
  const phone = (key: string, label: string) =>
    field(key, label, <PakistanMobileInput {...common(key)} wrapperClassName={"!border-[#d5e3dc] focus-within:!border-[#0f5c3e]" + (errors[key] ? " !border-red-500" : "")} value={str(values[key])} onValueChange={value => change(key, value)} />);
  const city = (key: string) =>
    field(key, "City", <PakistanCitySelect {...common(key)} aria-label="City" value={str(values[key])} className={inputClass + " pr-9 !border-[#d5e3dc] aria-[invalid=true]:!border-red-500"} onValueChange={value => change(key, value)} />);
  const province = (key: string) => {
    const value = str(values[key]);
    const options = value && !(PAKISTAN_PROVINCES as readonly string[]).includes(value) ? [...PAKISTAN_PROVINCES, value] : PAKISTAN_PROVINCES;
    return field(key, "Province", <select {...common(key)} className={inputClass} value={value} onChange={e => change(key, e.target.value)}><option value="">Select province</option>{options.map(p => <option key={p} value={p}>{p}</option>)}</select>);
  };
  const addressBlock = (prefix: "" | "pickup" | "return") => {
    const k = (name: string) => (prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name);
    return <div className="grid gap-4 sm:grid-cols-2">
      {field(k("address"), prefix ? "Address" : "Shop address", <input {...common(k("address"))} className={inputClass} value={str(values[k("address")])} maxLength={2000} placeholder="Shop / building, street, area" autoComplete="street-address" onChange={e => change(k("address"), e.target.value)} />, { className: "sm:col-span-2" })}
      {city(k("city"))}
      {province(k("province"))}
      {text(k("postalCode"), "Postal code", { optional: true, max: 20, autoComplete: "postal-code" })}
    </div>;
  };
  const toggle = (id: string, label: string, detail: string, checked: boolean, onChange: (value: boolean) => void) =>
    <label htmlFor={id} className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#e1ece6] bg-[#f6faf8] px-4 py-3">
      <span className="min-w-0"><span className="block text-sm font-semibold text-[#12352a]">{label}</span>{detail && <span className="mt-0.5 block truncate text-xs text-neutral-500">{detail}</span>}</span>
      <span className="relative inline-flex shrink-0 items-center">
        <input id={id} name={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-neutral-300 transition peer-checked:bg-[#0f5c3e] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0f5c3e]/40" />
        <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>;
  const note = (children: ReactNode) => <p className="rounded-lg bg-[#e9f5ee] px-4 py-2.5 text-xs font-medium text-[#0f5c3e]">{children}</p>;

  function docUpload(type: string) {
    const selected = files[type];
    const uploaded = docs.filter(d => d.documentType === type).slice(-1)[0];
    return <div key={type} className="min-w-0">
      <label className={"flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-[#f6faf8] px-4 py-3 focus-within:ring-2 focus-within:ring-[#0f5c3e]/30 " + (errors[type] ? "border-red-500" : "border-[#e1ece6]")}>
        {selected || uploaded ? <Check className="h-5 w-5 shrink-0 text-[#0f5c3e]" aria-hidden /> : <Upload className="h-5 w-5 shrink-0 text-[#0f5c3e]" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#12352a]">{DOC_LABELS[type]}</span>
          <span className="block truncate text-xs text-neutral-500">{selected ? selected.name : uploaded ? "Uploaded" : "JPG, PNG or WebP Â· max 5MB"}</span>
        </span>
        <span className="shrink-0 rounded-md bg-[#e1f0e7] px-2.5 py-1 text-xs font-semibold text-[#0f5c3e]">{selected || uploaded ? "Replace" : "Upload"}</span>
        <input type="file" name={type} accept={DOC_TYPES.join(",")} className="sr-only" aria-invalid={Boolean(errors[type]) || undefined} aria-describedby={errors[type] ? `${type}-error` : undefined} onChange={e => { chooseFile(type, e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {uploaded && !selected && <Link href={"/api/private/vendor-documents/" + uploaded.id} target="_blank" className="mt-1 inline-block text-xs font-semibold text-[#0f5c3e] underline">View uploaded</Link>}
      {errors[type] && <p id={`${type}-error`} className="mt-1 text-xs font-medium text-red-700">{errors[type]}</p>}
    </div>;
  }

  const isCompany = values.businessType === "company";
  const categoryOptions = str(values.category) && !categories.includes(str(values.category)) ? [...categories, str(values.category)] : categories;
  const phoneLabel = formatPakistanMobileInput(str(values.phone));

  function stepBody() {
    if (current === 0) return <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {text("shopName", "Store name", { max: 160, placeholder: "Your shop's name" })}
        {field("category", "What do you sell?", <select {...common("category")} className={inputClass} value={str(values.category)} onChange={e => change("category", e.target.value)}><option value="">{categories.length ? "Select category" : "Loading…"}</option>{categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}</select>)}
        {field("businessType", "Seller type", <select {...common("businessType")} className={inputClass} value={str(values.businessType)} onChange={e => change("businessType", e.target.value)}><option value="individual">Individual</option><option value="company">Registered business</option></select>, { className: "sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]" })}
      </div>
      {addressBlock("")}
      {showPhone ? <div className="sm:max-w-[calc(50%-0.5rem)]">{phone("phone", "Contact number")}</div>
        : <div className="flex flex-wrap items-center gap-2">{note(<>Contact number from signup: {phoneLabel}</>)}<button type="button" onClick={() => setShowPhone(true)} className="text-xs font-semibold text-[#0f5c3e] underline">Change</button></div>}
      <details className="group rounded-xl border border-[#e1ece6] px-4 py-3" open={Boolean(errors.shopDescription)}>
        <summary className="cursor-pointer text-sm font-semibold text-[#0f5c3e]">Add a short shop description <span className="font-normal text-neutral-500">(optional)</span></summary>
        <textarea {...common("shopDescription")} aria-label="Shop description" rows={3} maxLength={5000} className={inputClass + " mt-3 h-auto min-h-24 py-3"} value={str(values.shopDescription)} onChange={e => change("shopDescription", e.target.value)} />
      </details>
    </div>;

    if (current === 1) return <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {text("name", "Full name (as on CNIC)", { autoComplete: "name" })}
        {field("cnic", "CNIC number", <CnicInput {...common("cnic")} className={inputClass} placeholder="00000-0000000-0" value={str(values.cnic)} onValueChange={value => change("cnic", value)} />)}
        {isCompany && <>
          {text("businessLegalName", "Registered business name")}
          {text("businessRegNo", "Registration number", { max: 120 })}
          {text("taxNumber", "NTN", { optional: true, max: 32 })}
        </>}
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-[#12352a]">Upload your CNIC{isCompany ? " and registration document" : ""}</p>
        <div className="grid gap-3 sm:grid-cols-2">{requiredDocs(values).map(docUpload)}</div>
        {errors.documents && <p id="documents-error" className="mt-2 text-xs font-medium text-red-700">{errors.documents}</p>}
      </div>
      {note(isCompany ? "Documents are private and only seen by our verification team." : "Registered business? Change seller type in Step 1 to add its documents.")}
    </div>;

    if (current === 2) {
      const shopLine = [values.address, values.city].map(str).filter(Boolean).join(", ");
      return <div className="space-y-3">
        {toggle("pickupFromShop", "Pickup from my shop address", shopLine || "Add your shop address in Step 1", toggles.pickupFromShop, on => { pickupChosen.current = true; setToggles(t => ({ ...t, pickupFromShop: on })); })}
        {!toggles.pickupFromShop && <div className="rounded-xl border border-[#e1ece6] p-4">{addressBlock("pickup")}</div>}
        {toggle("contactFromAccount", "Use my contact for pickup", [str(values.name), phoneLabel].filter(Boolean).join(" Â· "), toggles.contactFromAccount, on => setToggles(t => ({ ...t, contactFromAccount: on })))}
        {!toggles.contactFromAccount && <div className="grid gap-4 rounded-xl border border-[#e1ece6] p-4 sm:grid-cols-2">{text("pickupContactName", "Contact person")}{phone("pickupPhone", "Contact phone")}</div>}
        {toggle("returnSameAsPickup", "Return address same as pickup", "", Boolean(values.returnSameAsPickup), on => change("returnSameAsPickup", on))}
        {!values.returnSameAsPickup && <div className="space-y-4 rounded-xl border border-[#e1ece6] p-4">{addressBlock("return")}<div className="grid gap-4 sm:grid-cols-2">{text("returnContactName", "Contact person")}{phone("returnPhone", "Contact phone")}</div></div>}
        {["pickupAddress", "pickupCity", "pickupProvince", "pickupContactName", "pickupPhone"].some(k => errors[k]) && (toggles.pickupFromShop || toggles.contactFromAccount) &&
          <p className="text-xs font-medium text-red-700">Your Step 1 or Step 2 details are incomplete. Complete them, or switch off the toggle and enter pickup details here.</p>}
        <p className="pt-1 text-xs text-neutral-500">Different address? Turn off a switch to add it.</p>
      </div>;
    }

    if (current === 3) {
      const bankValue = bankOther ? "Other" : str(values.bankName);
      const account = str(values.iban) || str(values.accountNumber);
      return <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {field(bankOther ? "bankChoice" : "bankName", "Choose your bank", <select {...(bankOther ? { id: "f-bankChoice", name: "bankChoice" } : common("bankName"))} className={inputClass} value={bankValue} onChange={e => { const other = e.target.value === "Other"; setBankOther(other); change("bankName", other ? "" : e.target.value); }}><option value="">Select bank</option>{PAKISTAN_BANK_OPTIONS.map(b => <option key={b} value={b}>{b === "Other" ? "Other bank" : b}</option>)}</select>)}
          {bankOther && text("bankName", "Bank name", { max: 120, placeholder: "Enter bank name" })}
          {text("accountTitle", "Account title", { hint: "Exactly as on your bank account." })}
          {field("accountNumber", "Account number / IBAN", <input {...common("accountNumber")} className={inputClass} value={account} maxLength={40} inputMode="text" autoComplete="off" placeholder="Enter account number or IBAN" onChange={e => {
            const raw = e.target.value;
            const compact = raw.replace(/\s/g, "").toUpperCase();
            // A Pakistani IBAN is stored as the IBAN too; a plain account number never becomes one.
            const isIban = /^PK\d{2}/.test(compact);
            setValues(v => ({ ...v, accountNumber: isIban ? compact : raw, iban: isIban ? compact : "" }));
            setErrors(er => ({ ...er, accountNumber: "", iban: "" }));
          }} />, { className: "sm:col-span-2" })}
          {errors.iban && <p className="text-xs font-medium text-red-700 sm:col-span-2">{errors.iban}</p>}
        </div>
        {note("Your bank details are private. We never ask for your PIN, OTP or password.")}
      </div>;
    }

    const cardErr = (step: number) => Object.keys(errors).some(key => errors[key] && stepOfField(key) === step);
    const pickupSummary = toggles.pickupFromShop ? "Shop address" : str(values.pickupCity) || "Not added";
    const cards = [
      { step: 0, title: "Shop", line: [str(values.shopName), str(values.category)].filter(Boolean).join(" Â· ") || "Not added" },
      { step: 1, title: "Identity", line: `CNIC ${maskCnic(str(values.cnic))} Â· ${requiredDocs(values).filter(t => docs.some(d => d.documentType === t)).length}/${requiredDocs(values).length} documents` },
      { step: 2, title: "Pickup & Return", line: `${pickupSummary} Â· ${values.returnSameAsPickup ? "Same returns" : "Separate returns"}` },
      { step: 3, title: "Payout", line: `${str(values.bankName) || "No bank"} Â· ${maskAccount(str(values.iban) || str(values.accountNumber))}` },
    ];
    return <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(card => { const Icon = STEPS[card.step].icon; return <div key={card.step} className={"flex items-start gap-3 rounded-xl border p-3.5 " + (cardErr(card.step) ? "border-red-400 bg-red-50/40" : "border-[#e1ece6]")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e9f5ee] text-[#0f5c3e]"><Icon className="h-5 w-5" aria-hidden /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#12352a]">{card.title}</span><span className="block truncate text-xs text-neutral-500">{card.line}</span>{cardErr(card.step) && <span className="mt-1 block text-xs font-medium text-red-700">Needs attention</span>}</span>
          <LoadingButton type="button" loadingLabel="…" disabled={busy} onClick={() => editStep(card.step)} className="shrink-0 text-xs font-semibold text-[#0f5c3e] hover:underline">Edit</LoadingButton>
        </div>; })}
      </div>
      <label className={"flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold text-[#12352a] " + (errors.declarationAccepted ? "border-red-400" : "border-[#e1ece6] bg-[#f6faf8]")}>
        <input type="checkbox" name="declarationAccepted" className="h-5 w-5 accent-[#0f5c3e]" checked={Boolean(values.declarationAccepted)} onChange={e => change("declarationAccepted", e.target.checked)} />
        I confirm my details are correct.
      </label>
      {errors.declarationAccepted && <p className="text-xs font-medium text-red-700">{errors.declarationAccepted}</p>}
    </div>;
  }

  if (loadError) return <Shell><section className="mx-auto max-w-3xl px-4 py-10"><div className="rounded-2xl bg-white p-6"><p role="alert" className="text-red-700">{loadError}</p><LoadingButton onClick={() => load()} className="mt-4 rounded-xl bg-[#0f5c3e] px-4 py-2 font-semibold text-white">Try again</LoadingButton></div></section></Shell>;

  const StepIcon = STEPS[current].icon;
  return <Shell>
    <header className="sticky top-0 z-30 border-b border-[#e1ece6] bg-white">
      <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
        {current > 0 && !loading && <LoadingButton type="button" aria-label="Back" loadingLabel="Saving…" disabled={busy} onClick={() => save("draft", current - 1)} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-[#0f5c3e] hover:bg-[#e9f5ee] sm:hidden"><ChevronLeft className="h-5 w-5" aria-hidden /></LoadingButton>}
        <LogoMark href="/" compact />
        <span className="text-base font-semibold">Seller Setup</span>
        <LoadingButton type="button" loadingLabel="Saving…" disabled={busy || loading} onClick={saveAndExit} className="ml-auto rounded-lg border border-[#d5e3dc] bg-[#f6faf8] px-3 py-2 text-xs font-semibold text-[#0f5c3e] hover:bg-[#e9f5ee]">Save &amp; Exit</LoadingButton>
      </div>
    </header>

    <div className="mx-auto max-w-4xl px-4 pb-10 pt-5 sm:pt-7">
      <nav aria-label="Seller setup steps">
        <ol className="mx-auto flex max-w-xl items-start">
          {STEPS.map((step, index) => {
            const done = index < current, active = index === current;
            return <li key={step.label} className="relative flex flex-1 flex-col items-center">
              {index > 0 && <span aria-hidden className={"absolute right-1/2 top-3.5 h-0.5 w-full " + (index <= current ? "bg-[#0f5c3e]" : "bg-[#dbe7e1]")} />}
              {done
                ? <button type="button" disabled={busy} onClick={() => save("draft", index)} aria-label={`Step ${index + 1}: ${step.title} (completed)`} className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0f5c3e] bg-[#0f5c3e] text-white transition hover:bg-[#0b4a31]"><Check className="h-3.5 w-3.5" aria-hidden /></button>
                : <span aria-current={active ? "step" : undefined} aria-label={`Step ${index + 1}: ${step.title}`} className={"relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold " + (active ? "border-[#0f5c3e] bg-[#0f5c3e] text-white ring-4 ring-[#0f5c3e]/15" : "border-[#cfdcd5] bg-white text-neutral-500")}>{index + 1}</span>}
              <span className={"mt-1.5 hidden text-xs sm:block " + (active ? "font-semibold text-[#0f5c3e]" : "text-neutral-500")}>{step.label}</span>
            </li>;
          })}
        </ol>
      </nav>

      <section className="mt-5 rounded-2xl border border-[#e1ece6] bg-white p-4 shadow-sm sm:mt-7 sm:p-7">
        <h1 className="mb-5 flex items-center gap-3 text-xl font-bold sm:text-2xl">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9f5ee] text-[#0f5c3e]"><StepIcon className="h-5 w-5" aria-hidden /></span>
          {STEPS[current].title}
          <span className="sr-only">, step {current + 1} of {STEPS.length}</span>
        </h1>
        {rejection && <p role="status" className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Please update your application: {rejection}</p>}
        {loading ? <PageSkeleton label="Loading your saved details…" rows={3} /> :
          <LoadingForm noValidate onSubmit={e => { e.preventDefault(); return current === 4 ? save("submit") : save("continue", current + 1); }}>
            <fieldset disabled={busy} className="min-w-0">{stepBody()}</fieldset>
            {message && <p role={saveError ? "alert" : "status"} aria-live="polite" className={"mt-5 rounded-xl px-4 py-3 text-sm " + (saveError ? "bg-red-50 text-red-800" : "bg-[#e9f5ee] text-[#0f5c3e]")}>{message}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              {current > 0 && <LoadingButton type="button" loadingLabel="Saving…" disabled={busy} onClick={() => save("draft", current - 1)} className="hidden min-h-12 rounded-xl px-5 text-sm font-semibold text-[#0f5c3e] hover:bg-[#e9f5ee] sm:inline-flex sm:items-center">Back</LoadingButton>}
              <LoadingButton type="submit" loadingLabel={current === 4 ? "Submitting…" : "Saving…"} disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0f5c3e] px-6 text-sm font-semibold text-white transition hover:bg-[#0b4a31] disabled:opacity-60 sm:w-auto">
                {current === 4 ? <>Submit for Approval <Check className="h-4 w-4" aria-hidden /></> : <>{fromReview ? "Save & Review" : "Continue"} <ArrowRight className="h-4 w-4" aria-hidden /></>}
              </LoadingButton>
            </div>
          </LoadingForm>}
      </section>
    </div>
  </Shell>;
}
