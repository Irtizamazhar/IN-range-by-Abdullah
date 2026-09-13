"use client";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
export function AccountSignIn() { const { openAuthModal } = useCustomerAuth(); return <button onClick={() => openAuthModal("login")} className="my-5 rounded-xl bg-brand-primary px-5 py-3 font-bold">Sign in to your account</button>; }