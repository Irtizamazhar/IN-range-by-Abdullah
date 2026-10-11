"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { Lock, Phone, User, X } from "lucide-react";
import { useEffect, useRef, type ComponentType } from "react";

const transition = { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const };

const inputClass =
  "h-11 w-full rounded-xl border border-[#DFEDE5] bg-white py-0 pl-10 pr-4 text-sm text-[#123D27] outline-none transition duration-200 placeholder:text-[#6B8073] focus:border-[#005235] focus:ring-2 focus:ring-[#B7E33A]/40";

function Field({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center">
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-[#005235]"
        aria-hidden
      />
      {children}
    </div>
  );
}

function initialsFromName(name: string) {
  const t = name.trim();
  if (!t) return "?";
  return t[0]!.toUpperCase();
}

export function CustomerProfileModal({
  isOpen,
  onClose,
  displayName,
  avatarUrl,
  name,
  setName,
  phone,
  setPhone,
  email,
  memberSinceLabel,
  loading,
  saving,
  onSave,
  onLogout,
}: {
  isOpen: boolean;
  onClose: () => void;
  displayName: string;
  avatarUrl?: string | null;
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  memberSinceLabel: string | null;
  loading: boolean;
  saving: boolean;
  onSave: () => void | Promise<void>;
  onLogout: () => void | Promise<unknown>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const reducedMotion = useReducedMotion();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previouslyFocused?.focus(); };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
          role="presentation"
        >
          <motion.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-[#063D2B]/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : transition}
            onClick={onClose}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-profile-title"
            className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-[440px] flex-col overflow-hidden rounded-3xl border border-[#DFEDE5] bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={reducedMotion ? { duration: 0 } : transition}
          >
            <div className="relative shrink-0 bg-gradient-to-br from-[#063D2B] to-[#005235] px-6 py-7 text-center text-white">
              <LoadingButton
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full p-2 text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B7E33A]"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </LoadingButton>

              <div className="mx-auto h-16 w-16 overflow-hidden rounded-full border-2 border-[#B7E33A] bg-white text-xl font-bold text-[#005235] shadow-md">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={displayName || "Profile image"}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    {initialsFromName(displayName || name)}
                  </div>
                )}
              </div>
              <h2
                id="customer-profile-title"
                className="mt-4 text-lg font-bold text-white sm:text-xl"
              >
                {displayName || name || "Your profile"}
              </h2>
              {memberSinceLabel ? (
                <p className="mt-1 text-xs text-white/85">
                  Member since {memberSinceLabel}
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#F7FAF7] px-5 py-5 sm:px-6">
              {loading ? (
                <PageSkeleton label="Loading your profile…" rows={3} />
              ) : (
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-[#123D27]">Full name<Field icon={User}>
                    <input
                      required
                      className={inputClass}
                      placeholder="Full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field></label>
                  <label className="block text-sm font-bold text-[#123D27]">Mobile number<Field icon={Phone}>
                    <input
                      type="tel"
                      className={inputClass}
                      placeholder="Phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </Field></label>
                  <label className="block text-sm font-bold text-[#123D27]">Email address
                    <Field icon={Lock}>
                      <input
                        readOnly
                        className={`${inputClass} cursor-not-allowed bg-[#EEF3EE] text-[#506257]`}
                        value={email}
                        aria-readonly
                      />
                    </Field>
                    <span className="mt-1.5 block text-xs font-normal text-[#506257]">
                      Email can’t be changed here
                    </span>
                  </label>

                  <LoadingButton
                    type="button"
                    loading={saving} loadingLabel="Saving…" disabled={!name.trim()}
                    onClick={() => onSave()}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#B7E33A] text-sm font-bold text-[#063D2B] shadow-sm transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#005235] disabled:pointer-events-none disabled:opacity-50"
                  >

                    Save changes
                  </LoadingButton>

                  <div className="border-t border-gray-200 pt-4">
                    <LoadingButton
                      type="button"
                      onClick={onLogout}
                      className="w-full py-2.5 text-center text-sm font-semibold text-red-600 transition-colors hover:text-red-700"
                    >
                      Log out
                    </LoadingButton>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
