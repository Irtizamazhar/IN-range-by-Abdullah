"use client";

import styles from "./PageSkeleton.module.css";
import { usePageLoading } from "@/hooks/usePageLoading";

export function PageSkeleton({ label = "Loading page…", rows = 4, variant = "page" }: { label?: string; rows?: number; variant?: "page" | "cards" | "table" }) {
  usePageLoading(true);
  return <section className={styles.root} role="status" aria-label={label} aria-busy="true">
    <span className={styles.srOnly}>{label}</span>
    <div aria-hidden="true">
      <div className={`${styles.block} ${styles.title}`} />
      <div className={`${styles.block} ${styles.subtitle}`} />
      <div className={variant === "cards" ? styles.grid : styles.rows}>
        {Array.from({ length: rows }, (_, index) => <div key={index} className={`${styles.card} ${variant === "table" ? styles.tableRow : ""}`}><div className={`${styles.block} ${styles.line}`} /><div className={`${styles.block} ${styles.short}`} /></div>)}
      </div>
    </div>
  </section>;
}
