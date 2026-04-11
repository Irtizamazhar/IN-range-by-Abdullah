"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Lock, Phone, User, X } from "lucide-react";
import type { ComponentType } from "react";

const transition = { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const };

const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white py-0 pl-10 pr-4 text-sm text-gray-900 outline-none transition duration-200 placeholder:text-gray-400 focus:border-primaryBlue focus:ring-2 focus:ring-primaryBlue/25";

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
        className="pointer-events-none absolute left-3 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-gray-400"
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
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  memberSinceLabel: string | null;
  loading: boolean;
  saving: boolean;
  onSave: () => void | Promise<void>;
  onLogout: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          role="presentation"
        >
          <motion.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-profile-title"
            className="relative flex max-h-[92vh] w-full max-w-[380px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={transition}
          >
            <div className="relative min-h-[140px] shrink-0 bg-gradient-to-br from-darkBlue to-primaryBlue px-6 py-8 text-center text-white">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full p-1.5 text-white transition-opacity duration-200 hover:opacity-80"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </button>

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-bold text-primaryBlue shadow-md">
                {initialsFromName(displayName || name)}
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

            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-gray-500">
                  <Loader2 className="h-8 w-8 animate-spin text-primaryBlue" />
                  <p className="text-sm font-medium">Loading…</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Field icon={User}>
                    <input
                      required
                      className={inputClass}
                      placeholder="Full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field icon={Phone}>
                    <input
                      type="tel"
                      className={inputClass}
                      placeholder="Phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </Field>
                  <div>
                    <Field icon={Lock}>
                      <input
                        readOnly
                        className={`${inputClass} cursor-not-allowed bg-gray-50 text-gray-600`}
                        value={email}
                        aria-readonly
                      />
                    </Field>
                    <p className="mt-1.5 text-xs text-gray-400">
                      Email can’t be changed here
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={saving || !name.trim()}
                    onClick={() => void onSave()}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primaryBlue text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-darkBlue disabled:pointer-events-none disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : null}
                    Save changes
                  </button>

                  <div className="border-t border-gray-200 pt-4">
                    <button
                      type="button"
                      onClick={onLogout}
                      className="w-full py-2.5 text-center text-sm font-semibold text-red-600 transition-colors hover:text-red-700"
                    >
                      Log out
                    </button>
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
