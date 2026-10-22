import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import logo from "@/public/logo.png";
import styles from "./LegalPage.module.css";

export type LegalSection = { id: string; title: string; content: ReactNode };

export function LegalPage({ kind, title, intro, review, sections }: { kind: string; title: string; intro: string; review?: string; sections: LegalSection[] }) {
  return <div className={styles.page}>
    <header className={styles.top}><div className={styles.topInner}>
      <Link href="/" aria-label="JORO home"><Image src={logo} alt="JORO" className={styles.logo} priority /></Link>
      <Link href="/" className={styles.homeLink}>← Back to home</Link>
    </div></header>
    <main className={styles.main}>
      <div className={styles.hero}><p className={styles.eyebrow}>{kind}</p><h1 className={styles.title}>{title}</h1><p className={styles.lede}>{intro}</p>{review && <p className={styles.status}>{review}</p>}</div>
      <div className={styles.grid}>
        <nav className={styles.toc} aria-label={`${title} sections`}><h2>On this page</h2><ol>{sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol></nav>
        <article className={styles.article}>{sections.map((section, index) => <section key={section.id} id={section.id} className={styles.section} aria-labelledby={`${section.id}-heading`}><h2 id={`${section.id}-heading`}><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>{section.title}</h2>{section.content}</section>)}</article>
      </div>
      <nav className={styles.related} aria-label="Related information"><Link className={styles.textLink} href="/">JORO home</Link><Link className={styles.textLink} href="/terms-and-conditions">Terms &amp; Conditions</Link><Link className={styles.textLink} href="/privacy-policy">Privacy Policy</Link></nav>
    </main>
    <footer className={styles.footer}>© {new Date().getFullYear()} JORO.pk · Pakistan marketplace</footer>
  </div>;
}
