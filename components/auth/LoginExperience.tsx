"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "@/components/ui/LoadingLink";
import { useSearchParams } from "next/navigation";
import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import { getSession, signIn, signOut, useSession } from "next-auth/react";
import { Lock, Mail, Phone, Store, User } from "lucide-react";
import { LogoMark } from "@/components/user/LogoMark";
import { PasswordToggleInput } from "@/components/ui/PasswordToggleInput";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { vendorEntry } from "@/lib/vendor-entry";
import { safeAccountLink } from "@/lib/customer-account-policy";
import { formatPakistanMobileInput, normalizePakistanMobile, pakistanMobileInputMaxLength, PAKISTAN_MOBILE_ERROR } from "@/lib/pakistan-phone";

type Role="customer"|"vendor"; type Mode="signin"|"signup";
const oauthErrors:Record<string,string>={OAuthAccountNotLinked:"An account already exists with this email. Sign in using your existing method first.",OAuthEmailRequired:"Your provider did not supply a verified email. Use email and password to create your account.",AccessDenied:"Sign-in was cancelled or this account is unavailable.",OAuthSignin:"Social sign-in could not start. Please try again.",OAuthCallback:"Social sign-in could not finish. Please try again.",Callback:"Social sign-in could not finish. Please try again."};
function ProviderIcon({provider}:{provider:"google"}) {
 if (provider !== "google") return null;
 return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09a7.2 7.2 0 0 1 0-4.18V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.8 10.8 0 0 0 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84A6.6 6.6 0 0 1 12 5.38z"/></svg>;
}
function Tabs<T extends string>({label,values,current,onChange,disabled,roleSwitch=false}:{label:string;values:readonly T[];current:T;onChange:(value:T)=>void|Promise<void>;disabled:boolean;roleSwitch?:boolean}) {
 return <div role="tablist" aria-label={label} className={`grid grid-cols-2 ${roleSwitch?"gap-1 rounded-xl bg-neutral-100 p-1":"mt-2 border-b"}`} onKeyDown={e=>{const index=values.indexOf(current);const next=e.key==="ArrowRight"?values[(index+1)%values.length]:e.key==="ArrowLeft"?values[(index+values.length-1)%values.length]:e.key==="Home"?values[0]:e.key==="End"?values[values.length-1]:null;if(next&&!disabled){e.preventDefault();onChange(next);(e.currentTarget.children[values.indexOf(next)] as HTMLElement).focus();}}}>{values.map(value=><LoadingButton key={value} type="button" role="tab" aria-selected={current===value} tabIndex={current===value?0:-1} disabled={disabled} onClick={()=>onChange(value)} className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${current===value?(roleSwitch?"bg-[#063D29] text-white shadow-sm":"bg-lime-50 text-emerald-900"):"text-neutral-600"}`}>{roleSwitch&&(value==="customer"?<User className="h-4 w-4"/>:<Store className="h-4 w-4"/>)}{value==="customer"?"Customer":value==="vendor"?"Vendor":value==="signin"?"Sign In":"Sign Up"}</LoadingButton>)}</div>;
}
export function LoginExperience({initialRole,initialMode,googleEnabled,development=false}:{initialRole:Role;initialMode:Mode;googleEnabled:boolean;development?:boolean}) {
 const router=useRouter(), search=useSearchParams(); const {data:session,status}=useSession();
 const role:Role=search?.get("role")==="vendor"?"vendor":search?.get("role")==="customer"?"customer":initialRole;
 const mode:Mode=search?.get("mode")==="signup"?"signup":search?.get("mode")==="signin"?"signin":initialMode;
 const [busy,setBusy]=useState(false);const [vendor,setVendor]=useState<{ownerName:string;status:string}|null>(null);const [vendorLoading,setVendorLoading]=useState(true);
 useEffect(()=>{const c=new AbortController();fetch("/api/vendor/me",{signal:c.signal,cache:"no-store"}).then(async r=>{if(r.ok)setVendor((await r.json()).vendor);else setVendor(null);}).catch(()=>{}).finally(()=>{if(!c.signal.aborted)setVendorLoading(false);});return()=>c.abort();},[]);
 const change=(nextRole:Role,nextMode:Mode)=>{return router.replace(`/login?role=${nextRole}&mode=${nextMode}`,{scroll:false});};
 const callback=safeAccountLink(search?.get("callbackUrl"))||"/";const error=search?.get("error");
 const authenticated=role==="customer"?session?.user?.role==="customer":Boolean(vendor);
 return <main className="joro-auth-page flex min-h-dvh w-full bg-white text-brand-dark">
  <AuthBrandPanel className="hidden lg:flex lg:w-1/2"/>
  <section className="flex w-full flex-col lg:w-1/2" aria-label="Account access">
   <div className="bg-[#063D29] px-5 py-4 text-center lg:hidden"><LogoMark href={null} className="justify-center [&_img]:max-h-9 [&_img]:w-auto"/><p className="mt-1 text-[10px] font-bold tracking-widest text-brand-primary">APNI MARKET • APNI CHOICE</p></div>
   <div className="px-5 pt-3 text-xs sm:px-8"><Link className="font-semibold text-emerald-800 underline" href="/">Back to home</Link></div>
   <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-5 py-4 sm:px-8">
    <Tabs label="Choose account type" values={["customer","vendor"]} current={role} onChange={r=>change(r,mode)} disabled={busy} roleSwitch/>
    <Tabs label="Sign in or sign up" values={["signin","signup"]} current={mode} onChange={m=>change(role,m)} disabled={busy}/>
    {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{oauthErrors[error]||"Sign-in could not finish. Please try again."}</p>}
    {(role==="customer"?status==="loading":vendorLoading)?<PageSkeleton label="Checking your session…" rows={2} />:authenticated?<div className="py-8"><h1 className="text-2xl font-bold">Welcome back, {role==="customer"?session?.user?.name:vendor?.ownerName}</h1>{role==="customer"?<div className="mt-5 grid gap-3"><Link className="joro-auth-primary" href="/">Continue Shopping</Link><Link className="text-center font-bold text-emerald-800" href="/account">My Account</Link></div>:<Link className="joro-auth-primary mt-5" href={vendorEntry(vendor?.status).href}>{vendorEntry(vendor?.status).label}</Link>}<LoadingButton className="mt-5 underline" onClick={async()=>{if(role==="customer")await signOut({redirect:false});else {const r=await fetch("/api/vendor/logout",{method:"POST"});if(!r.ok)throw new Error("Could not sign out. Please try again.");setVendor(null);}await router.refresh();}}>Logout</LoadingButton></div>:<AuthForm key={`${role}:${mode}`} role={role} mode={mode} callback={callback} google={googleEnabled} development={development} setBusy={setBusy}/>}
    <p className="mt-2 text-center text-xs leading-5 text-neutral-500">Your account stays private. <Link href="/terms-and-conditions" className="underline">Terms & conditions</Link></p>
   </div>
  </section>
 </main>;
}
function AuthForm({role,mode,callback,google,development,setBusy}:{role:Role;mode:Mode;callback:string;google:boolean;development:boolean;setBusy:(value:boolean)=>void}) {
 const router=useRouter();const {update}=useSession();const [values,setValues]=useState({name:"",email:"",phone:"",password:"",confirm:""});const [errors,setErrors]=useState<Record<string,string>>({});const [message,setMessage]=useState("");const [pending,setPending]=useState(false);const [forgot,setForgot]=useState(false);const [remember,setRemember]=useState(false);const [vendorCode,setVendorCode]=useState("");
 const signup=mode==="signup", vendor=role==="vendor";
 const phoneInputRef = useRef<HTMLInputElement>(null);
 const phoneSelectionRef = useRef<{ start: number; end: number } | null>(null);
 useLayoutEffect(() => {
  const selection = phoneSelectionRef.current;
  phoneSelectionRef.current = null;
  if (selection && document.activeElement === phoneInputRef.current) {
   phoneInputRef.current?.setSelectionRange(selection.start, selection.end);
  }
 });
 function updatePhone(input: HTMLInputElement) {
  const raw = input.value;
  const formatted = formatPakistanMobileInput(raw);
  if (formatted !== raw) {
   const mapPosition = (position: number) => {
    const characters = raw.slice(0, position).replace(/[ -]/g, "").length;
    if (!characters) return 0;
    let count = 0;
    for (let index = 0; index < formatted.length; index++) {
     if (formatted[index] !== " " && formatted[index] !== "-" && ++count === characters) return index + 1;
    }
    return formatted.length;
   };
   phoneSelectionRef.current = {
    start: mapPosition(input.selectionStart ?? raw.length),
    end: mapPosition(input.selectionEnd ?? raw.length),
   };
  }
  setValues(previous => ({...previous, phone: formatted}));
  setErrors(previous => ({...previous, phone: ""}));
 }
 useEffect(()=>()=>setBusy(false),[setBusy]);
 async function submit(e:React.FormEvent){e.preventDefault();setErrors({});setMessage("");const normalizedPhone=normalizePakistanMobile(values.phone);const issues:Record<string,string>={};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))issues.email="Enter a valid email address.";if(signup&&vendor&&!normalizedPhone)issues.phone=PAKISTAN_MOBILE_ERROR;if(signup&&!values.name.trim())issues.name="Full name is required.";if(!forgot&&!values.password)issues.password="Password is required.";if(signup&&values.password.length<(vendor?8:6))issues.password=`Use at least ${vendor?8:6} characters.`;if(signup&&values.confirm!==values.password)issues.confirm="Passwords do not match.";if(Object.keys(issues).length){setErrors(issues);return;}setPending(true);setBusy(true);
 try{
  const email=values.email.trim();
  if(forgot){const r=await fetch("/api/customer/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const d=await r.json();if(!r.ok)throw Error(d.error||"Please try again.");setMessage("If an account exists, a reset link will be sent to your email.");return;}
  if(signup){const r=await fetch(vendor?"/api/vendor/signup":"/api/customer/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:values.name.trim(),email,password:values.password,...(vendor?{phone:normalizedPhone}:{})})});const d=await r.json();if(!r.ok)throw Error(d.error||"Account could not be created.");}
  if(vendor){const r=await fetch("/api/vendor/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password:values.password,rememberMe:remember})});const d=await r.json();if(!r.ok){setVendorCode(d.code||"");throw Error(d.error||"Sign-in failed.");}await router.push(safeAccountLink(d.next)||"/vendor/dashboard");}
  else{const result=await signIn("credentials",{email,password:values.password,redirect:false});if(!result||result.error)throw Error(signup?"Account created. Please sign in using your new password.":"Invalid email or password, or your account is inactive.");const session=await getSession();if(session?.user?.role!=="customer")throw Error("Sign-in could not be verified. Please try again.");await update();await router.push(callback);await router.refresh();}
 }catch(error){setMessage(error instanceof Error?error.message:"Could not reach the server. Please try again.");}finally{setPending(false);setBusy(false);}}
 const field = (name: keyof typeof values, label: string, type = "text") => {
  const phone = name === "phone";
  const description = [phone ? "hint-phone" : "", errors[name] ? `error-${name}` : ""].filter(Boolean).join(" ") || undefined;
  return <div key={name}>
   <label htmlFor={`auth-${name}`} className="mb-1 block text-xs font-bold">{label}</label>
   <div className="relative">
    {type === "password" ? <Lock aria-hidden className="joro-auth-field-icon" /> : name === "email" ? <Mail aria-hidden className="joro-auth-field-icon" /> : phone ? <Phone aria-hidden className="joro-auth-field-icon" /> : <User aria-hidden className="joro-auth-field-icon" />}
    {type === "password" ? <PasswordToggleInput id={`auth-${name}`} autoComplete={signup ? "new-password" : "current-password"} value={values[name]} onChange={e => setValues({...values, [name]: e.target.value})} placeholder={name === "confirm" ? "Repeat your password" : "Enter your password"} className="joro-auth-input pr-11" aria-invalid={Boolean(errors[name])} aria-describedby={description} maxLength={72} /> : <input
     ref={phone ? phoneInputRef : undefined}
     id={`auth-${name}`} type={type} inputMode={phone ? "tel" : undefined}
     autoComplete={name === "name" ? "name" : phone ? "tel" : "email"}
     value={values[name]}
     onChange={e => {
      if (phone) updatePhone(e.currentTarget);
      else setValues({...values, [name]: e.target.value});
     }}
     onPaste={phone ? e => {
      const input = e.currentTarget;
      if (input.selectionStart === 0 && input.selectionEnd === input.value.length) {
       // A pasted international number may be longer than the previous local format.
       e.preventDefault();
       const pasted = formatPakistanMobileInput(e.clipboardData.getData("text"));
       if (pasted.length > pakistanMobileInputMaxLength(pasted)) return;
       input.setRangeText(pasted, 0, input.value.length, "end");
       updatePhone(input);
      }
     } : undefined}
     onKeyDown={phone ? e => {
      const input = e.currentTarget;
      const position = input.selectionStart;
      if (position === null || position !== input.selectionEnd || e.ctrlKey || e.metaKey || e.altKey) return;
      // Delete the adjacent digit instead of getting stuck on an inserted dash.
      if (e.key === "Backspace" && input.value[position - 1] === "-") input.setSelectionRange(position - 1, position - 1);
      if (e.key === "Delete" && input.value[position] === "-") input.setSelectionRange(position + 1, position + 1);
     } : undefined}
     onBlur={phone ? e => {
      const normalized = normalizePakistanMobile(e.target.value);
      if (normalized) setValues(previous => ({...previous, phone: normalized}));
     } : undefined}
     placeholder={name === "name" ? "Your full name" : phone ? "0300-1234567" : "you@example.com"}
     className="joro-auth-input" maxLength={phone ? pakistanMobileInputMaxLength(values.phone) : name === "name" ? 200 : 255}
     aria-invalid={Boolean(errors[name])} aria-describedby={description}
    />}
   </div>
   {phone && <p id="hint-phone" className="mt-1 text-xs text-neutral-500">Use 03XX-XXXXXXX or +92-3XX-XXXXXXX.</p>}
   {errors[name] && <p id={`error-${name}`} className="mt-1 text-xs text-red-700">{errors[name]}</p>}
  </div>;
 };
 return <div className="mt-2"><h1 className="text-2xl font-black leading-tight">{forgot?"Reset your password":signup?(vendor?"Start Selling on JORO":"Create Your JORO Account"):(vendor?"Welcome Back, Seller":"Welcome Back")}</h1><p className="mt-1 text-sm leading-5 text-neutral-600">{forgot?"Enter your email to receive a password reset link.":signup?(vendor?"Create your seller account and grow your business with JORO.":"Join JORO and start shopping your way."):(vendor?"Sign in to manage your JORO store and business.":"Sign in to your JORO account and continue your journey.")}</p>
     {message&&<p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{message}{vendorCode==="suspended"&&<Link href="/vendor/login?appeal=1" className="ml-2 underline">Request reactivation</Link>}{vendorCode==="unverified"&&<Link href="/vendor/verify-email" className="ml-2 underline">Verify email</Link>}</p>}
 <LoadingForm onSubmit={submit} noValidate className="mt-3"><fieldset disabled={pending} className="grid gap-2">{signup&&field("name","Full Name")}{field("email","Email","email")}{signup&&vendor&&field("phone","Mobile Number","tel")}{!forgot&&field("password","Password","password")}{signup&&field("confirm","Confirm Password","password")}{!signup&&!forgot&&<div className="flex items-center justify-between gap-3 text-xs">{vendor?<label className="flex items-center gap-2"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Remember me</label>:<span/>}{vendor?<Link href="/vendor/forgot-password" className="font-bold text-emerald-800">Forgot password?</Link>:<LoadingButton type="button" onClick={()=>{setForgot(true);setValues({...values,password:"",confirm:""});setErrors({});}} className="font-bold text-emerald-800">Forgot password?</LoadingButton>}</div>}<LoadingButton className="joro-auth-primary" type="submit" loadingLabel={forgot?"Sending…":signup?"Creating account…":"Signing in…"}>{forgot?"Send reset link":signup?(vendor?"Create Seller Account":"Create Account"):(vendor?"Sign In as Vendor":"Sign In")}</LoadingButton>{forgot&&<LoadingButton type="button" className="text-sm underline" onClick={()=>setForgot(false)}>Back to sign in</LoadingButton>}</fieldset></LoadingForm>
 {signup&&vendor&&<p className="mt-2 text-xs leading-5 text-neutral-500">Next: business details and verification. Admin approval is required before selling.</p>}
 {!vendor&&!forgot&&(development||google)&&<><div className="my-3 flex items-center gap-3 text-xs text-neutral-500"><span className="h-px flex-1 bg-neutral-200"/>OR<span className="h-px flex-1 bg-neutral-200"/></div><div className="grid gap-2 min-[420px]:grid-cols-1">{(development||google)&&<LoadingButton type="button" disabled={pending} title={google?undefined:"Google configuration required in .env.local"} onClick={async()=>{if(!google){setMessage("Google login is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local, then restart the server.");return;}setPending(true);setBusy(true);try{await signIn("google",{callbackUrl:"/"},{prompt:"select_account"});}catch{setMessage("Social sign-in could not start. Please try again.");}finally{setPending(false);setBusy(false);}}} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 px-2 text-xs font-bold hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"><ProviderIcon provider="google"/>Continue with Google</LoadingButton>}</div>{development&&!google&&<p className="mt-2 text-center text-xs text-neutral-500">Social sign-in needs provider configuration. Email and password work normally.</p>}</>}
 </div>;
}
