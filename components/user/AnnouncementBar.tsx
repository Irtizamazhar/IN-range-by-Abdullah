import Image from "next/image";
import { Compass, MessageSquarePlus, Search, Store } from "lucide-react";
import styles from "./AnnouncementBar.module.css";

export const MARKETPLACE_HIGHLIGHTS = [
  { Icon: Search, label: "Find products & services", mobile: "Discover JORO" },
  { Icon: MessageSquarePlus, label: "Request a Want" },
  { Icon: Store, label: "Connect with sellers" },
  { Icon: Compass, label: "Explore opportunities" },
] as const;

export function AnnouncementBar() {
  return <div className={styles.space}>
    <section className={styles.bar} aria-label="JORO marketplace highlights">
      <Image src="/branding/header-strip/pakistan-flag-wave.png" alt="Pakistan flag" width={24} height={24} className={styles.corner} />
      <ul className={styles.items}>{MARKETPLACE_HIGHLIGHTS.map(({ Icon, label, ...item }) => <li key={label} className={styles.item}>
        <Icon aria-hidden="true" />
        {"mobile" in item ? <><span className={styles.desktopText}>{label}</span><span className={styles.mobileText}>{item.mobile}</span></> : <span>{label}</span>}
      </li>)}</ul>
      <Image src="/branding/header-strip/minar-e-pakistan.png" alt="Minar-e-Pakistan" width={24} height={24} className={styles.corner} />
    </section>
  </div>;
}
