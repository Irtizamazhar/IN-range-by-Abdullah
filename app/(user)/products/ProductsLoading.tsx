"use client";

import { usePageLoading } from "@/hooks/usePageLoading";
import { ProductCardSkeleton } from "@/components/user/ProductCard";
import styles from "./Products.module.css";

export function ProductsLoading() {
  usePageLoading(true);
  return <div className={styles.page}>
    <div className={styles.container}>
      <header className={styles.heading}><div className={styles.titleRow}><h1>All Products</h1></div></header>
      <p className="sr-only" role="status">Loading products</p>
      <div className={styles.layout} aria-busy="true">
        <aside className={styles.sidebar} aria-hidden="true"><div className="h-96 rounded-xl bg-[#f0f3ec] motion-safe:animate-pulse" /></aside>
        <div>
          <div className={styles.collectionHeading}><h2>Just For You</h2></div>
          <div className={styles.grid}>{Array.from({ length: 18 }, (_, index) => <ProductCardSkeleton key={index} variant="marketplace" />)}</div>
        </div>
      </div>
    </div>
  </div>;
}
