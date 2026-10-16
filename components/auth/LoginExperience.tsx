"use client";

import { PageSkeleton } from "@/components/ui/PageSkeleton";

import { LoadingButton } from "@/components/ui/LoadingButton";

import { LoadingForm } from "@/components/ui/LoadingForm";

import { useEffect, useRef, useState } from "react";

import Link from "@/components/ui/LoadingLink";

import { useSearchParams } from "next/navigation";

import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";

import { getSession, signIn, signOut, useSession } from "next-auth/react";

import { ArrowLeft, Lock, Mail, Store, User } from "lucide-react";

import { LogoMark } from "@/components/user/LogoMark";

import { PasswordToggleInput } from "@/components/ui/PasswordToggleInput";

import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import styles from "./AuthLayout.module.css";
import { PakistanMobileInput } from "@/components/ui/PakistanMobileInput";

import { vendorEntry } from "@/lib/vendor-entry";

import { safeAccountLink } from "@/lib/customer-account-policy";
import { setCustomerOAuthRememberChoice } from "@/lib/customer-remember-policy";

import { normalizePakistanMobile, PAKISTAN_MOBILE_ERROR } from "@/lib/pakistan-phone";



type Role="customer"|"vendor"; type Mode="signin"|"signup";

const oauthErrors:Record<string,string>={OAuthAccountNotLinked:"An account already exists with this email. Sign in using your existing method first.",OAuthEmailRequired:"Your provider did not supply a verified email. Use email and password to create your account.",AccessDenied:"Sign-in was cancelled or this account is unavailable.",OAuthSignin:"Social sign-in could not start. Please try again.",OAuthCallback:"Social sign-in could not finish. Please try again.",Callback:"Social sign-in could not finish. Please try again."};

function ProviderIcon({provider}:{provider:"google"}) {

 if (provider !== "google") return null;

 return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09a7.2 7.2 0 0 1 0-4.18V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.8 10.8 0 0 0 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84A6.6 6.6 0 0 1 12 5.38z"/></svg>;

}

function Tabs<T extends string>({label,values,current,onChange,disabled,roleSwitch=false}:{label:string;values:readonly T[];current:T;onChange:(value:T)=>void|Promise<void>;disabled:boolean;roleSwitch?:boolean}) {

 return <div role="tablist" aria-label={label} className={roleSwitch?`${styles.roleTabs} grid grid-cols-2 gap-2`:`${styles.modeTabs} mt-2 grid grid-cols-2 border-b border-neutral-200`} onKeyDown={e=>{const index=values.indexOf(current);const next=e.key==="ArrowRight"?values[(index+1)%values.length]:e.key==="ArrowLeft"?values[(index+values.length-1)%values.length]:e.key==="Home"?values[0]:e.key==="End"?values[values.length-1]:null;if(next&&!disabled){e.preventDefault();onChange(next);(e.currentTarget.children[values.indexOf(next)] as HTMLElement).focus();}}}>{values.map(value=><LoadingButton key={value} type="button" role="tab" aria-label={roleSwitch?(value==="customer"?"Customer":"Vendor"):undefined} aria-selected={current===value} tabIndex={current===value?0:-1} disabled={disabled} onClick={()=>onChange(value)} className={roleSwitch?`joro-auth-role ${current===value?"joro-auth-role-active":""}`:`joro-auth-tab ${current===value?"joro-auth-tab-active":""}`}>{roleSwitch?<>{value==="customer"?<User className="h-5 w-5 shrink-0"/>:<Store className="h-5 w-5 shrink-0"/>}<span className="min-w-0 text-left"><strong className="block text-[13px] font-bold sm:text-sm">{value==="customer"?"Customer":"Vendor"}</strong><small className={styles.roleSubtitle}>{value==="customer"?"Shop, request & explore":"Sell products & services"}</small></span></>:value==="signin"?"Sign In":"Sign Up"}</LoadingButton>)}</div>;

}

export function LoginExperience({initialRole,initialMode,googleEnabled,development=false}:{initialRole:Role;initialMode:Mode;googleEnabled:boolean;development?:boolean}) {

 const router=useRouter(), search=useSearchParams(); const {data:session,status}=useSession();

 const role:Role=search?.get("role")==="vendor"?"vendor":search?.get("role")==="customer"?"customer":initialRole;

 const mode:Mode=search?.get("mode")==="signup"?"signup":search?.get("mode")==="signin"?"signin":initialMode;

 const authScrollRef = useRef<HTMLElement | null>(null);

 useEffect(() => {
  if (authScrollRef.current) authScrollRef.current.scrollTop = 0;
 }, [role, mode]);

 const [busy,setBusy]=useState(false);const [vendor,setVendor]=useState<{ownerName:string;status:string}|null>(null);const [vendorLoading,setVendorLoading]=useState(true);

 useEffect(()=>{const c=new AbortController();fetch("/api/vendor/me",{signal:c.signal,cache:"no-store"}).then(async r=>{if(r.ok)setVendor((await r.json()).vendor);else setVendor(null);}).catch(()=>{}).finally(()=>{if(!c.signal.aborted)setVendorLoading(false);});return()=>c.abort();},[]);

 const callback=safeAccountLink(search?.get("callbackUrl"))||"/";const error=search?.get("error");

 const change=(nextRole:Role,nextMode:Mode)=>{return router.replace(`/login?role=${nextRole}&mode=${nextMode}${callback!=="/"?`&callbackUrl=${encodeURIComponent(callback)}`:""}`,{scroll:false});};

 const authenticated=role==="customer"?session?.user?.role==="customer":Boolean(vendor);

 return <main data-auth-mode={mode} data-auth-role={role} className={`${styles.page} joro-auth-page flex min-h-dvh w-full bg-[#f7f8f7] text-brand-dark`}>

  <AuthBrandPanel className={`${styles.brandColumn} hidden lg:flex lg:w-[48%]`}/>

  <section ref={authScrollRef} className={`${styles.formColumn} flex w-full items-center justify-center px-3 py-3 sm:px-6 sm:py-4 lg:w-[52%] lg:px-6`} aria-label="Account access">

   <div className={`${styles.card} joro-auth-card relative flex w-full max-w-[720px] flex-col px-5 pb-5 pt-12 sm:px-8 sm:pb-6 sm:pt-12 lg:px-7 xl:px-11`}>

    <Link className="absolute right-5 top-5 inline-flex items-center gap-2 text-sm font-bold text-[#065333] hover:underline sm:right-8" href="/"><ArrowLeft className="h-4 w-4"/>Back to home</Link>

   <div className={`${styles.formInner} mx-auto w-full max-w-[520px]`}>

    <div className={styles.logoRow}><LogoMark href={null} className={styles.formLogo}/></div>

    <div className="mb-3 text-center"><h1 className="text-[25px] font-black tracking-tight text-neutral-950 sm:text-[30px]">{mode==="signup"?(role==="vendor"?"Start Selling on JORO":"Join the JORO Family"):"Welcome Back"}</h1><p className="mt-1 text-[12px] leading-[1.4] text-neutral-600 sm:text-[13px]">{mode==="signup"?(role==="vendor"?"Create your seller account and grow your business on JORO.pk.":"Create your account to shop, post requests, and connect with sellers."):"Sign in to your JORO account and continue your journey."}</p></div>

    <Tabs label="Choose account type" values={["customer","vendor"]} current={role} onChange={r=>change(r,mode)} disabled={busy} roleSwitch/>

    <Tabs label="Sign in or sign up" values={["signin","signup"]} current={mode} onChange={m=>change(role,m)} disabled={busy}/>

    {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{oauthErrors[error]||"Sign-in could not finish. Please try again."}</p>}
    {role==="customer"&&mode==="signin"&&search?.get("registered")==="1"&&<p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Account created successfully! Please log in to continue.</p>}

    {(role==="customer"?status==="loading":vendorLoading)?<PageSkeleton label="Checking your session…" rows={2} />:authenticated?<div className="py-8"><h1 className="text-2xl font-bold">Welcome back, {role==="customer"?session?.user?.name:vendor?.ownerName}</h1>{role==="customer"?<div className="mt-5 grid gap-3"><Link className="joro-auth-primary" href="/">Continue Shopping</Link><Link className="text-center font-bold text-emerald-800" href="/account">My Account</Link></div>:<Link className="joro-auth-primary mt-5" href={vendorEntry(vendor?.status).href}>{vendorEntry(vendor?.status).label}</Link>}<LoadingButton className="mt-5 underline" onClick={async()=>{if(role==="customer")await signOut({redirect:false});else {const r=await fetch("/api/vendor/logout",{method:"POST"});if(!r.ok)throw new Error("Could not sign out. Please try again.");setVendor(null);}await router.refresh();}}>Logout</LoadingButton></div>:<AuthForm key={`${role}:${mode}`} role={role} mode={mode} callback={callback} google={googleEnabled} development={development} setBusy={setBusy}/>}

    {!(mode==="signup"&&role==="customer")&&<p className="mt-4 text-center text-xs leading-5 text-neutral-500">By continuing, you agree to our <Link href="/terms-and-conditions" className="font-semibold text-emerald-800 underline">Terms &amp; Conditions</Link>.</p>}

   </div>

   </div>

  </section>

 </main>;

}

function AuthForm({role,mode,callback,google,development,setBusy}:{role:Role;mode:Mode;callback:string;google:boolean;development:boolean;setBusy:(value:boolean)=>void}) {

 const router=useRouter();const {data:currentSession,update}=useSession();const [values,setValues]=useState({name:"",email:"",phone:"",password:"",confirm:""});const [errors,setErrors]=useState<Record<string,string>>({});const [message,setMessage]=useState("");const [pending,setPending]=useState(false);const [forgot,setForgot]=useState(false);const [remember,setRemember]=useState(false);const [vendorCode,setVendorCode]=useState("");const [draftRestored,setDraftRestored]=useState(false);

 const signup=mode==="signup", vendor=role==="vendor";

 useEffect(()=>{if(!signup||vendor)return;try{const raw=sessionStorage.getItem("joro:customer-signup-terms-draft");if(!raw)return;sessionStorage.removeItem("joro:customer-signup-terms-draft");const draft=JSON.parse(raw) as {name?:string;email?:string;phone?:string;savedAt?:number};if(typeof draft.savedAt!=="number"||Date.now()-draft.savedAt>15*60*1000)return;setValues(previous=>({...previous,name:draft.name||"",email:draft.email||"",phone:draft.phone||"",password:"",confirm:""}));setDraftRestored(true);}catch{/* Storage may be disabled. */}},[signup,vendor]);

 function saveTermsDraft(){try{sessionStorage.setItem("joro:customer-signup-terms-draft",JSON.stringify({name:values.name,email:values.email,phone:values.phone,savedAt:Date.now()}));}catch{/* The form remains usable if storage is disabled. */}}

 useEffect(()=>()=>setBusy(false),[setBusy]);

 async function submit(e:React.FormEvent){e.preventDefault();setErrors({});setMessage("");const normalizedPhone=normalizePakistanMobile(values.phone);const issues:Record<string,string>={};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))issues.email="Enter a valid email address.";if(signup&&vendor&&!normalizedPhone)issues.phone=PAKISTAN_MOBILE_ERROR;if(signup&&!vendor&&values.phone.trim()&&!normalizedPhone)issues.phone=PAKISTAN_MOBILE_ERROR;if(signup&&!values.name.trim())issues.name="Full name is required.";if(!forgot&&!values.password)issues.password="Password is required.";if(signup&&values.password.length<(vendor?8:6))issues.password=`Use at least ${vendor?8:6} characters.`;if(signup&&values.confirm!==values.password)issues.confirm="Passwords do not match.";if(Object.keys(issues).length){setErrors(issues);return;}setPending(true);setBusy(true);

 try{

  const email=values.email.trim();

  if(forgot){const r=await fetch("/api/customer/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const d=await r.json();if(!r.ok)throw Error(d.error||"Please try again.");setMessage("If an account exists, a reset link will be sent to your email.");return;}

  if(signup){const r=await fetch(vendor?"/api/vendor/signup":"/api/customer/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:values.name.trim(),email,password:values.password,phone:normalizedPhone||""})});const d=await r.json();if(!r.ok)throw Error(d.error||"Account could not be created.");if(!vendor){await router.replace("/login?role=customer&mode=signin&registered=1");return;}}

  if(vendor){const r=await fetch("/api/vendor/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password:values.password,rememberMe:remember})});const d=await r.json();if(!r.ok){setVendorCode(d.code||"");throw Error(d.error||"Sign-in failed.");}if(currentSession?.user?.role==="customer")await signOut({redirect:false});await router.push(safeAccountLink(d.next)||"/vendor/dashboard");}

  else{const result=await signIn("credentials",{email,password:values.password,rememberMe:remember,redirect:false});if(!result||result.error)throw Error("Invalid email or password, or your account is inactive.");const session=await getSession();if(session?.user?.role!=="customer")throw Error("Sign-in could not be verified. Please try again.");await fetch("/api/vendor/logout",{method:"POST"}).catch(()=>{});await update();const welcome=await fetch("/api/customer/welcome",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);await router.push(welcome?.showWelcome?"/":callback);await router.refresh();}

 }catch(error){setMessage(error instanceof Error?error.message:"Could not reach the server. Please try again.");}finally{setPending(false);setBusy(false);}}

 const field = (name: keyof typeof values, label: string, type = "text") => {
  const phone = name === "phone";
  const description = [phone ? "hint-phone" : "", errors[name] ? `error-${name}` : ""].filter(Boolean).join(" ") || undefined;
  return <div key={name} className={styles.field}>
   <label htmlFor={`auth-${name}`} className="mb-2 block text-xs font-bold">{label}</label>
   {phone ? <PakistanMobileInput id={`auth-${name}`} aria-label={label} value={values.phone} onValueChange={value=>{setValues(previous=>({...previous,phone:value}));setErrors(previous=>({...previous,phone:""}));}} className="joro-auth-input" aria-invalid={Boolean(errors.phone)} aria-describedby={description}/> : <div className="relative">
    {type === "password" ? <Lock aria-hidden className="joro-auth-field-icon" /> : name === "email" ? <Mail aria-hidden className="joro-auth-field-icon" /> : <User aria-hidden className="joro-auth-field-icon" />}
    {type === "password" ? <PasswordToggleInput id={`auth-${name}`} autoComplete={signup ? "new-password" : "current-password"} value={values[name]} onChange={e => setValues({...values, [name]: e.target.value})} placeholder={name === "confirm" ? "Repeat your password" : "Enter your password"} className="joro-auth-input pr-11" aria-invalid={Boolean(errors[name])} aria-describedby={description} maxLength={72} /> : <input id={`auth-${name}`} type={type} autoComplete={name === "name" ? "name" : "email"} value={values[name]} onChange={e => setValues({...values, [name]: e.target.value})} placeholder={name === "name" ? "Your full name" : "you@example.com"} className="joro-auth-input" maxLength={name === "name" ? 200 : 255} aria-invalid={Boolean(errors[name])} aria-describedby={description}/>}
   </div>}
   {phone && <p id="hint-phone" className="mt-2 text-xs leading-5 text-neutral-500">Enter 10 digits starting with 3. Country code +92 is included.</p>}
   {errors[name] && <p id={`error-${name}`} className="mt-1 text-xs text-red-700">{errors[name]}</p>}
  </div>;
 };
 return <div className="mt-2 sm:mt-3">{forgot&&<p className="mb-4 text-sm text-neutral-600">Enter your email to receive a password reset link.</p>}

     {message&&<p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{message}{vendorCode==="suspended"&&<Link href="/vendor/login?appeal=1" className="ml-2 underline">Request reactivation</Link>}{vendorCode==="unverified"&&<Link href="/vendor/verify-email" className="ml-2 underline">Verify email</Link>}</p>}

 <LoadingForm onSubmit={submit} noValidate className="mt-2"><fieldset disabled={pending} className={styles.fields}>{signup&&field("name","Full Name")}{field("email","Email","email")}{signup&&field("phone",vendor?"Mobile Number":"Phone number (optional)","tel")}{!forgot&&field("password","Password","password")}{signup&&<PasswordStrength password={values.password} minLength={vendor?8:6}/>} {signup&&field("confirm","Confirm Password","password")}{!signup&&!forgot&&<div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1 text-xs"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Remember me</label>{vendor?<Link href="/vendor/forgot-password" className="inline-flex min-h-11 items-center px-1 font-bold text-emerald-800">Forgot password?</Link>:<LoadingButton type="button" onClick={()=>{setForgot(true);setValues({...values,password:"",confirm:""});setErrors({});}} className="inline-flex min-h-11 items-center px-1 font-bold text-emerald-800">Forgot password?</LoadingButton>}</div>}<LoadingButton className="joro-auth-primary mt-1" type="submit" loadingLabel={forgot?"Sending…":signup?"Creating account…":"Signing in…"}>{forgot?"Send reset link":signup?(vendor?"Create Seller Account":"Create Account"):(vendor?"Sign In as Vendor":"Sign In")}</LoadingButton>{forgot&&<LoadingButton type="button" className="text-sm underline" onClick={()=>setForgot(false)}>Back to sign in</LoadingButton>}</fieldset></LoadingForm>

 {signup&&!vendor&&<p className="mt-4 text-center text-xs leading-5 text-neutral-600">By continuing, you agree to our <Link href="/terms-and-conditions" onClick={saveTermsDraft} className="font-semibold text-emerald-800 underline">Terms &amp; Conditions</Link>. {draftRestored&&"Your details were restored. Re-enter your password to continue."}</p>}

 {signup&&vendor&&<p className="mt-2 text-xs leading-5 text-neutral-500">Next: business details and verification. Admin approval is required before selling.</p>}

 {!vendor&&!forgot&&(development||google)&&<><div className="my-5 flex items-center gap-3 text-xs text-neutral-500"><span className="h-px flex-1 bg-neutral-200"/>OR<span className="h-px flex-1 bg-neutral-200"/></div><div className="grid gap-2 min-[420px]:grid-cols-1">{(development||google)&&<LoadingButton type="button" disabled={pending} title={google?undefined:"Google configuration required in .env.local"} onClick={async()=>{if(!google){setMessage("Google login is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local, then restart the server.");return;}setPending(true);setBusy(true);try{setCustomerOAuthRememberChoice(!signup&&remember);await signIn("google",{callbackUrl:callback},{prompt:"select_account"});}catch{setMessage("Social sign-in could not start. Please try again.");}finally{setPending(false);setBusy(false);}}} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 px-2 text-xs font-bold hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"><ProviderIcon provider="google"/>Continue with Google</LoadingButton>}</div></>}

 </div>;

}
