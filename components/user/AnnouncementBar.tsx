import Image from "next/image";
import { BadgeCheck, HeartHandshake, PackageCheck, RotateCcw, ShieldCheck, Store, Tags, TrendingUp, Truck } from "lucide-react";

const ITEMS = [
  { icon: Tags, label: "Market Deals" },
  { icon: PackageCheck, label: "Fast Orders" },
  { icon: Store, label: "Support Local" },
  { icon: BadgeCheck, label: "Verified Sellers" },
  { icon: ShieldCheck, label: "Secure Payments" },
  { icon: TrendingUp, label: "Trending Wants" },
  { icon: RotateCcw, label: "Easy Returns" },
  { icon: Truck, label: "Nationwide Delivery" },
  { icon: HeartHandshake, label: "Grow Together" },
] as const;

export function AnnouncementBar() {
  return (
    <div className="joro-topstrip-space">
      <div className="joro-topstrip" aria-label="JORO marketplace highlights">
        <div className="joro-topstrip-corner">
          <Image src="/branding/header-strip/pakistan-flag-wave.png" alt="Pakistan flag" width={40} height={40} sizes="40px" priority />
        </div>
        <div className="joro-topstrip-window">
          <div className="joro-topstrip-track">
            {[0, 1].map(copy => (
              <div key={copy} className="joro-topstrip-group" aria-hidden={copy === 1 ? true : undefined}>
                {ITEMS.map(({ icon: Icon, label }) => (
                  <span key={label} className="joro-topstrip-item">
                    <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                    <span>{label}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="joro-topstrip-corner">
          <Image src="/branding/header-strip/minar-e-pakistan.png" alt="Minar-e-Pakistan" width={40} height={40} sizes="40px" priority />
        </div>
      </div>
    </div>
  );
}