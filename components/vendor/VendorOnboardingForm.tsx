"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/ui/LoadingLink";
import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import { LogoMark } from "@/components/user/LogoMark";
import { CnicInput } from "@/components/ui/CnicInput";
import { slugifyStoreName } from "@/lib/store-slug";
import { vendorSetupSchema, setupStepErrors } from "@/lib/vendor-onboarding-schema";
const SAVE_TIMEOUT_MS=30000;
const steps=["Store & Business","Identity / KYC","Pickup & Return","Bank / Payout","Review"];
type Values=Record<string,string|boolean|number>;
const business=[["shopName","Store Name"],["storeSlug","Store Slug"],["category","Primary Product Category"],["shopDescription","Store / Business Description"],["phone","Contact Number"],["address","Business Address"],["city","City"],["province","Province / Region"],["postalCode","Postal Code (optional)"]];
const identity=[["name","Legal Full Name"],["cnic","CNIC Number"]];
const bank=[["accountTitle","Account Title"],["bankName","Bank Name"],["accountNumber","Account Number"],["iban","IBAN (optional)"]];
const pickup=[["pickupAddress","Pickup Address"],["pickupCity","Pickup City"],["pickupProvince","Pickup Province"],["pickupPostalCode","Pickup Postal Code (optional)"],["pickupContactName","Pickup Contact Person"],["pickupPhone","Pickup Contact Phone"]];
const returns=[["returnAddress","Return Address"],["returnCity","Return City"],["returnProvince","Return Province"],["returnPostalCode","Return Postal Code (optional)"],["returnContactName","Return Contact Person"],["returnPhone","Return Contact Phone"]];
export function VendorOnboardingForm(){
 const router=useRouter();const [values,setValues]=useState<Values>({businessType:"individual",returnSameAsPickup:true,declarationAccepted:false});
 const [email,setEmail]=useState("");const [current,setCurrent]=useState(0);const [docs,setDocs]=useState<{id:string;documentType:string}[]>([]);
 const [files,setFiles]=useState<Record<string,File>>({});const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
 const saveLock=useRef(false);
 const [loadError,setLoadError]=useState("");const [message,setMessage]=useState("");const [errors,setErrors]=useState<Record<string,string>>({});const [rejection,setRejection]=useState("");
 const [saveError,setSaveError]=useState(false);
 const load=useCallback(async(signal?:AbortSignal)=>{
  try{const r=await fetch("/api/vendor/onboarding",{cache:"no-store",signal});const data=await r.json();if(!r.ok)throw Error(data.error||"Could not load setup.");const v=data.vendor;
  setValues({...v,...(v.onboardingData||{}),name:v.ownerName,category:v.primaryCategory||"",cnic:v.cnic||"",businessRegNo:v.businessRegNo||"",storeSlug:v.storeSlug||"",shopDescription:v.shopDescription||"",iban:v.iban||"",businessType:v.businessType,returnSameAsPickup:v.onboardingData?.returnSameAsPickup??true,declarationAccepted:false});
  setEmail(v.email);setDocs(v.documents);setCurrent(Math.max(0,Math.min(4,Number(v.onboardingData?.step)||0)));setRejection(v.rejectionReason||"");
  setLoadError("");
  }catch(error){if(!signal?.aborted)setLoadError(error instanceof Error?error.message:"Could not load setup.");}finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
 useEffect(()=>{const key=Object.keys(errors)[0];if(key)document.querySelector<HTMLElement>(`[name="${key}"]`)?.focus();},[errors]);
 function change(key:string,value:string|boolean){setValues(v=>({...v,[key]:value,...(key==="shopName"&&(!v.storeSlug||v.storeSlug===slugifyStoreName(String(v.shopName||"")))?{storeSlug:slugifyStoreName(String(value))}:{})}));setErrors(e=>({...e,[key]:""}));}
 async function save(submit=false,next=current){
  if(saveLock.current)return false;
  setMessage("");setErrors({});setSaveError(false);
  if(next>current){const fieldErrors=setupStepErrors(values,current);if(current===1){const required=values.businessType==="company"?["cnic_front","cnic_back","license"]:["cnic_front","cnic_back"];if(required.some(type=>!files[type]&&!docs.some(doc=>doc.documentType===type)))fieldErrors.documents="Upload all required verification documents before continuing.";}if(Object.keys(fieldErrors).length){setErrors(fieldErrors);setSaveError(true);setMessage("Please check the highlighted details before continuing.");return false;}}
  if(submit){const checked=vendorSetupSchema.safeParse(values);if(!checked.success){setErrors(Object.fromEntries(checked.error.issues.map(i=>[i.path.join("."),i.message])));setSaveError(true);setMessage("Please edit the highlighted details before submitting.");return false;}}
  saveLock.current=true;setBusy(true);
  try {
   const form=new FormData();
   const allowed=[...business,...identity,...bank,...pickup,...returns].map(([key])=>key).concat(["businessType","businessRegNo","businessLegalName","taxNumber","returnSameAsPickup","declarationAccepted"]);
   for(const key of allowed)if(values[key]!==undefined&&values[key]!==null)form.set(key,String(values[key]));
   form.set("step",String(next));if(next>current){form.set("intent","continue");form.set("currentStep",String(current));}for(const [key,file] of Object.entries(files))form.set(key,file);
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),SAVE_TIMEOUT_MS);
   let r:Response;let d:{ok?:boolean;error?:string;fieldErrors?:Record<string,string>;documents?:{id:string;documentType:string}[]}|null;
   try{r=await fetch("/api/vendor/onboarding",{method:submit?"POST":"PATCH",body:form,signal:controller.signal,credentials:"same-origin"});d=await r.json().catch(error=>{if(controller.signal.aborted)throw error;return null;});}
   finally{clearTimeout(timeout);}
   if(!r.ok){if(d?.fieldErrors)setErrors(d.fieldErrors);if(r.status===401)throw Error("Your seller session has expired. Sign in again, then return to this page. Your entries remain here.");throw Error(typeof d?.error==="string"?d.error:"The server could not save your details. Please retry in a moment.");}
   if(d?.ok!==true)throw Error("The server did not confirm your save. Please try again.");
   if(submit){await router.push("/vendor/status");return true;}
   if(d.documents){setDocs(d.documents);setFiles({});}
   setCurrent(next);setMessage("Progress saved. You can continue setup after signing in again.");return true;
  }catch(e){setSaveError(true);setMessage(e instanceof Error&&e.name==="AbortError"?"The save timed out. Your entries are still here; check your saved progress before retrying.":e instanceof Error?e.message:"Could not save setup. Please retry.");return false;}finally{saveLock.current=false;setBusy(false);}
 }
 function fields(list:string[][]){return list.map(([key,label])=>{
  const inputProps={
   name:key,value:String(values[key]??""),"aria-label":label,
   maxLength:key==="shopDescription"?5000:key.toLowerCase().includes("address")?2000:200,
   "aria-invalid":Boolean(errors[key]),"aria-describedby":errors[key]?key+"-error":undefined,
   className:"mt-2 h-12 w-full min-w-0 rounded-xl border border-[#ccdcda] bg-white px-3 font-normal transition focus:border-[#005055] focus:outline-none focus:ring-2 focus:ring-teal-100",
   placeholder:key.toLowerCase().includes("phone")||key==="phone"?"03XX-XXXXXXX":key==="cnic"?"00000-0000000-0":undefined,
  };
  return <label key={key} className="block min-w-0 text-sm font-semibold">{label}{key==="cnic"
   ?<CnicInput {...inputProps} onValueChange={value=>change(key,value)}/>
   :key==="shopDescription"||key.toLowerCase().includes("address")?<textarea {...inputProps} rows={3} className={inputProps.className+" h-auto min-h-28 py-3"} onChange={e=>change(key,e.target.value)}/>:<input {...inputProps} list={key.toLowerCase().includes("province")?"pakistan-provinces":undefined} onChange={e=>change(key,e.target.value)}/>}
   {errors[key]&&<span id={key+"-error"} className="mt-1 block text-xs text-red-700">{errors[key]}</span>}</label>;
 });}
 const groups=[business,values.businessType==="company"?[...identity,["businessLegalName","Registered Business Name"],["businessRegNo","Registration Number"],["taxNumber","NTN (optional)"]]:identity,pickup,bank];
 if(loadError)return <main className="min-h-dvh bg-[#f3f8f7] px-4 pt-7 pb-28 text-[#123536]"><section className="mx-auto max-w-4xl rounded-3xl bg-white p-5"><p role="alert" className="text-red-700">{loadError}</p><LoadingButton onClick={()=>load()} className="mt-4 rounded-xl bg-brand-primary px-4 py-2 font-bold">Retry loading setup</LoadingButton></section></main>;
 return <main className="min-h-dvh bg-[#f3f8f7] px-4 pt-7 pb-28 text-[#123536]"><section className="mx-auto max-w-4xl rounded-3xl border border-[#dce9e7] bg-white p-5 shadow-sm sm:p-8">
  <LogoMark href="/"/><p className="mt-2 text-xs font-bold text-emerald-800">APNI MARKET • APNI CHOICE</p><h1 className="mt-6 text-3xl font-bold">Continue Seller Setup</h1>
  <p className="mt-3 break-words text-sm leading-6 text-neutral-600">Complete your details for admin approval. Account: {email}</p>
  <div className="mt-5 flex items-center justify-between text-xs font-semibold text-[#005055]"><span>Step {current+1} of {steps.length}</span><span>Save now, finish later</span></div>
  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e4efed]" role="progressbar" aria-label="Seller setup progress" aria-valuemin={1} aria-valuemax={5} aria-valuenow={current+1}><div className="h-full rounded-full bg-[#005055] transition-all duration-300" style={{width:`${(current+1)/steps.length*100}%`}}/></div>
  <datalist id="pakistan-provinces">{["Punjab","Sindh","Khyber Pakhtunkhwa","Balochistan","Islamabad Capital Territory","Azad Jammu and Kashmir","Gilgit-Baltistan"].map(province=><option key={province} value={province}/>)}</datalist>
  {rejection&&<p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">Please correct your application: {rejection}</p>}
  <nav aria-label="Seller setup steps" className="mt-6 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-5">{steps.map((label,index)=><LoadingButton key={label} type="button" disabled={busy||loading||index>current} aria-current={index===current?"step":undefined} loadingLabel="Saving…" onClick={()=>save(false,index)} className={"min-h-12 rounded-xl border px-2 py-2 text-xs font-bold "+(index===current?"border-[#005055] bg-[#005055] text-white":index<current?"border-teal-200 bg-teal-50 text-[#005055]":"bg-neutral-50 text-neutral-500")}>{index<current?"✓ ":""}{index+1}. {label}</LoadingButton>)}</nav>
  {loading?<PageSkeleton label="Loading your saved details…" rows={3} />:<LoadingForm onSubmit={e=>{e.preventDefault();return save(current===4,current===4?4:current+1);}} noValidate className="mt-7">
   <fieldset disabled={busy}><legend className="mb-5 text-xl font-bold">{steps[current]}</legend>
   {current===0&&<div className="grid gap-4 sm:grid-cols-2">{fields(business)}<label className="text-sm font-semibold">Seller Type<select className="mt-2 h-12 w-full rounded-xl border px-3" value={String(values.businessType)} onChange={e=>change("businessType",e.target.value)}><option value="individual">Individual</option><option value="company">Business / Company</option></select></label></div>}
   {current===1&&<><div className="grid gap-4 sm:grid-cols-2">{fields(identity)}{values.businessType==="company"&&fields([["businessLegalName","Registered Business Name"],["businessRegNo","Business Registration Number"],["taxNumber","NTN / Tax Registration Number (optional)"]])}</div><p className="mt-4 text-xs text-neutral-600">{values.businessType==="company"?"Enter the authorized representative’s legal name and CNIC.":"Use your legal identity details."} Documents remain private.</p>{errors.documents&&<p id="documents-error" role="alert" className="mt-3 text-sm text-red-700">{errors.documents}</p>}<div className="mt-5 grid gap-4 sm:grid-cols-2">{(values.businessType==="company"?["cnic_front","cnic_back","license"]:["cnic_front","cnic_back"]).map(type=><div key={type} className="min-w-0"><label className="text-sm font-semibold">{type==="cnic_front"?"CNIC front":type==="cnic_back"?"CNIC back":"Business registration document"}<input type="file" aria-invalid={Boolean(errors.documents)} aria-describedby={errors.documents?"documents-error":undefined} accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full rounded-xl border p-3 text-xs" onChange={e=>{const file=e.target.files?.[0];if(file)setFiles(f=>({...f,[type]:file}));}}/></label>{docs.filter(d=>d.documentType===type).slice(-1).map(d=><Link key={d.id} href={"/api/private/vendor-documents/"+d.id} target="_blank" className="mt-2 block text-xs font-bold text-emerald-800 underline">View uploaded document</Link>)}</div>)}</div><p className="mt-3 text-xs text-neutral-500">JPG, PNG or WebP, up to 5MB each.</p></>}
   {current===2&&<><LoadingButton type="button" onClick={()=>setValues(v=>({...v,pickupAddress:v.address||"",pickupCity:v.city||"",pickupProvince:v.province||"",pickupPostalCode:v.postalCode||"",pickupContactName:v.name||"",pickupPhone:v.phone||""}))} className="mb-4 text-sm font-bold text-emerald-800 underline">Use business address for pickup</LoadingButton><div className="grid gap-4 sm:grid-cols-2">{fields(pickup)}</div><label className="my-5 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={Boolean(values.returnSameAsPickup)} onChange={e=>change("returnSameAsPickup",e.target.checked)}/>Return address same as pickup</label>{!values.returnSameAsPickup&&<div className="grid gap-4 sm:grid-cols-2">{fields(returns)}</div>}</>}
   {current===3&&<><div className="grid gap-4 sm:grid-cols-2">{fields(bank)}</div><p className="mt-4 text-xs leading-5 text-neutral-500">These details are used for seller payouts. We never ask for your PIN, CVV, OTP or banking password.</p></>}
   {current===4&&<div className="space-y-5"><div className="rounded-xl bg-neutral-50 p-4"><h2 className="font-bold">Account</h2><p className="mt-2 break-all text-sm">{email}</p></div>{groups.map((list,index)=><section key={index} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><h2 className="font-bold">{steps[index]}</h2><LoadingButton type="button" onClick={()=>save(false,index)} className="text-sm font-bold text-emerald-800 underline">Edit {steps[index]}</LoadingButton></div><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">{list.map(([key,label])=><div key={key} className="min-w-0"><dt className="text-xs text-neutral-500">{label}</dt><dd className="mt-1 break-words">{String(values[key]||"Not provided")}</dd>{errors[key]&&<p className="text-xs text-red-700">{errors[key]}</p>}</div>)}</dl>{index===1&&<p className="mt-3 text-sm">Private documents: {Array.from(new Set(docs.map(d=>d.documentType))).join(", ")||"None uploaded"}</p>}{index===2&&<p className="mt-3 text-sm">Return: {values.returnSameAsPickup?"Same as pickup":[values.returnAddress,values.returnCity,values.returnProvince,values.returnContactName,values.returnPhone].filter(Boolean).join(", ")}</p>}</section>)}{Object.entries(errors).filter(([key])=>!groups.flat().some(([k])=>key===k)).map(([key,error])=><p key={key} className="text-sm text-red-700">{key}: {error}</p>)}<label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={Boolean(values.declarationAccepted)} onChange={e=>change("declarationAccepted",e.target.checked)} className="mt-1"/>I confirm that the submitted business, identity, address and payout details are accurate.</label></div>}
   </fieldset>
   {message&&<p role={saveError?"alert":"status"} aria-live="polite" className={"mt-5 rounded-xl border p-4 text-sm "+(saveError?"border-red-200 bg-red-50 text-red-800":"border-teal-200 bg-teal-50 text-[#005055]")}>{message}</p>}
   <div className="mt-7 border-t border-[#dce9e7] pt-5">
    <div className="grid grid-cols-2 items-stretch gap-3">
     <LoadingButton type="button" disabled={busy} loadingLabel="Saving…" onClick={()=>save()} className="min-h-12 rounded-xl border border-[#b8cecb] px-3 py-3 text-sm font-bold text-[#005055]">Save Progress</LoadingButton>
     <LoadingButton type="submit" loadingLabel="Saving…" disabled={busy} className="min-h-12 rounded-xl bg-[#005055] px-3 py-3 text-sm font-bold text-white transition hover:bg-[#003e42] disabled:opacity-50">{current===4?"Submit for Approval":"Save & Continue"}</LoadingButton>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">{current>0&&<LoadingButton type="button" disabled={busy} onClick={()=>save(false,current-1)} className="min-h-11 px-2 py-3 text-sm font-bold text-[#005055]">Back</LoadingButton>}<Link href="/login?role=vendor&mode=signin" className="px-2 py-3 text-sm font-semibold">My seller account</Link></div>
   </div>  </LoadingForm>}{loading&&message&&<p role="alert">{message}</p>}
 </section></main>;
}
