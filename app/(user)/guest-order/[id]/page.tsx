import { GuestOrderTracking } from "@/components/user/GuestOrderTracking";
export const metadata = { title: "Guest order tracking", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function Page({ params }: { params: { id: string } }) { return <GuestOrderTracking id={params.id} />; }
