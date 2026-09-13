"use client";
import { Fragment } from "react";
import { useSession } from "next-auth/react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
export function AccountPrivate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession(); const { openAuthModal } = useCustomerAuth();
  if (status === "loading") return <p className="my-6" role="status">Loading your account…</p>;
  if (session?.user?.role !== "customer" || !session.user.id) return <div className="my-6"><p>Sign in to view your private account information.</p><button onClick={() => openAuthModal("login")} className="mt-4 rounded-xl bg-brand-primary px-5 py-3 font-bold">Sign in</button></div>;
  return <Fragment key={session.user.id}>{children}</Fragment>;
}