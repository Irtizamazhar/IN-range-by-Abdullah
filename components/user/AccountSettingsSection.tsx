"use client";
import type { FormEvent } from "react";
import Link from "@/components/ui/LoadingLink";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { Bell, CalendarDays, ChevronRight, Mail, Phone, Save, ShieldCheck, User, UserRound, type LucideIcon } from "lucide-react";

type Profile = { name: string; email: string; phone: string; createdAt: string };

/** Only links to pages that exist: notifications (with its email-preferences menu) and the privacy policy. */
const accountLinks: { href: string; title: string; text: string; icon: LucideIcon }[] = [
  { href: "/account/notifications", title: "Notifications", text: "See your latest updates and manage email preferences.", icon: Bell },
  { href: "/privacy-policy", title: "Privacy", text: "Read how JORO collects, uses and protects your data.", icon: ShieldCheck },
];
const input = "block h-11 w-full min-w-0 rounded-xl border border-[#DFEAE3] bg-white pl-10 pr-3.5 text-sm text-brand-dark placeholder:text-darkText/40 focus:border-brand-link focus:outline-none focus:ring-2 focus:ring-brand-link/20";
const label = "block text-[13px] font-semibold text-brand-dark sm:text-sm";
const icon = "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-darkText/45";

/**
 * Account Settings tab: the existing profile form (name and phone are saved; email is shown read-only, as before)
 * beside links to the related account pages; stacked on phones and tablets.
 */
export function AccountSettingsSection({ profile, onSave }: { profile: Profile; onSave: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const since = new Date(profile.createdAt);
  return <section className="mt-4 rounded-2xl border border-[#DFEAE3] bg-white p-4 shadow-[0_1px_2px_rgba(0,61,43,0.04),0_6px_18px_rgba(0,61,43,0.04)] sm:mt-5 sm:p-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
    <div className="min-w-0">
      <div className="flex items-start gap-3.5">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EC] text-[#005235] sm:h-12 sm:w-12"><UserRound className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" /></span>
        <div className="min-w-0"><h2 className="text-base font-bold text-brand-dark sm:text-lg">Profile Information</h2><p className="mt-0.5 text-[13px] text-darkText/60 sm:text-sm">Update your basic information and how others see you on JORO.</p></div>
      </div>
      <LoadingForm onSubmit={onSave} className="mt-5 space-y-4">
        <label className={label}>Name<span className="relative mt-1.5 block"><User className={icon} aria-hidden="true" /><input className={input} name="name" defaultValue={profile.name} maxLength={200} required autoComplete="name" /></span></label>
        <label className={label}>Phone<span className="relative mt-1.5 block"><Phone className={icon} aria-hidden="true" /><input className={input} name="phone" type="tel" defaultValue={profile.phone} maxLength={40} placeholder="Enter your phone number" autoComplete="tel" /></span></label>
        <div>
          <label className={label}>Email<span className="relative mt-1.5 block"><Mail className={icon} aria-hidden="true" /><input className={`${input} cursor-not-allowed bg-[#F4F7F5] text-darkText/70`} type="email" value={profile.email} readOnly aria-describedby="email-help" /></span></label>
          <p id="email-help" className="mt-1 text-xs text-darkText/50">Email cannot be changed from here.</p>
        </div>
        <p className="flex items-center gap-2 text-[13px] text-darkText/60 sm:text-sm"><CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />Member since {Number.isNaN(since.getTime()) ? "—" : since.toLocaleDateString("en-PK")}</p>
        <LoadingButton className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 text-sm font-semibold text-brand-dark transition hover:bg-brand-hover disabled:opacity-60 sm:w-auto"><Save className="h-4 w-4" aria-hidden="true" />Save profile</LoadingButton>
      </LoadingForm>
    </div>

    <div className="mt-6 min-w-0 border-t border-[#EEF3EF] pt-5 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
      <h2 className="text-base font-bold text-brand-dark sm:text-lg">Your Account</h2>
      <p className="mt-0.5 text-[13px] text-darkText/60 sm:text-sm">Keep your account secure and up to date.</p>
      <nav aria-label="Account pages" className="mt-4 space-y-3">
        {accountLinks.map(({ href, title, text, icon: Icon }) => <Link key={href} href={href} className="group flex min-w-0 items-center gap-3.5 rounded-xl border border-[#E6EFE8] bg-[#F4FAF2] p-3.5 transition hover:border-[#B5DCA0] hover:bg-[#EEF7EA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link sm:p-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#005235]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-brand-dark sm:text-[15px]">{title}</span><span className="mt-0.5 block text-[13px] leading-5 text-darkText/60">{text}</span></span>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#DFEAE3] bg-white text-[#005235] transition group-hover:border-brand-primary group-hover:bg-brand-primary" aria-hidden="true"><ChevronRight className="h-4 w-4" /></span>
        </Link>)}
      </nav>
    </div>
  </section>;
}
