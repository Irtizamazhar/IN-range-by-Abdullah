import { Suspense } from "react";
import { AccountNavigation } from "@/components/user/AccountNavigation";
import { AccountPrivate } from "@/components/user/AccountPrivate";
export default function MyStuffLayout({ children }: { children: React.ReactNode }) { return <><Suspense><AccountNavigation /></Suspense><AccountPrivate>{children}</AccountPrivate></>; }