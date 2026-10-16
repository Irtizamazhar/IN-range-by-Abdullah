import Image from "next/image";
import logo from "@/public/logo.png";
import styles from "./GlobalLoader.module.css";

export function GlobalLoaderVisual({ message }: { message: string }) {
  return <div className={styles.content} role="status" aria-live="polite" aria-atomic="true">
    <div className={styles.ring} role="progressbar" aria-label={message} aria-valuetext={message}>
      <svg className={styles.track} viewBox="0 0 240 240" aria-hidden="true">
        <circle cx="120" cy="120" r="105" fill="none" stroke="#d7e3df" strokeWidth="5" />
      </svg>
      <svg className={styles.arc} viewBox="0 0 240 240" aria-hidden="true">
        <defs><linearGradient id="joro-loader-green" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#005235"/><stop offset="0.55" stopColor="#008F3B"/><stop offset="1" stopColor="#B7E33A"/></linearGradient></defs>
        <circle cx="120" cy="120" r="105" fill="none" stroke="url(#joro-loader-green)" strokeWidth="7" strokeLinecap="round" strokeDasharray="205 660" />
        <circle cx="120" cy="15" r="6" fill="#B7E33A" className={styles.spark} />
      </svg>
      <Image src={logo} alt="JORO.pk" className={styles.logo} priority />
    </div>
    <p className={styles.message}>{message}</p>
  </div>;
}
