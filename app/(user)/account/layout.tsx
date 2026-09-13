import { Suspense } from "react";
import { AccountNavigation } from "@/components/user/AccountNavigation";
export default function AccountLayout({ children }: { children: React.ReactNode }) { return <><Suspense fallback={null}><AccountNavigation /></Suspense>{children}</>; }