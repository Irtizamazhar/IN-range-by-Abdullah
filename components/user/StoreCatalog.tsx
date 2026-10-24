"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ProductCard, type ProductCardData } from "./ProductCard";
import styles from "./StoreProfile.module.css";

/** Presentation-only filtering of the store's existing, server-selected products. */
export function StoreCatalog({ products }: { products: ProductCardData[] }) {
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach(product => { if (product.category) counts.set(product.category, (counts.get(product.category) || 0) + 1); });
    return Array.from(counts);
  }, [products]);
  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    const rows = products.filter(product => (!category || product.category === category) && (!text || `${product.name} ${product.category}`.toLocaleLowerCase().includes(text)));
    if (sort === "price-low") rows.sort((a, b) => a.price - b.price);
    if (sort === "price-high") rows.sort((a, b) => b.price - a.price);
    return rows;
  }, [products, category, query, sort]);

  return <section id="store-products" className={styles.catalog} aria-label="Store products">
    {categories.length > 0 && <aside className={styles.categories} aria-label="Store product categories">
      <h2>Categories</h2>
      <button type="button" aria-pressed={!category} onClick={() => setCategory("")}>All Products <span>({products.length})</span></button>
      {categories.map(([name, count]) => <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)}>{name}<span>({count})</span></button>)}
    </aside>}
    <div className={styles.catalogBody}>
      <div className={styles.toolbar}>
        <label className={styles.search}><Search aria-hidden="true" size={17}/><span className="sr-only">Search in this store</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search in this store..." /></label>
        <label className={styles.sort}><span>Sort by:</span><select aria-label="Sort store products" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
        {categories.length > 0 && <label className={styles.mobileCategories}><span className="sr-only">Product category</span><select aria-label="Product category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All Products ({products.length})</option>{categories.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}</select></label>}
      </div>
      <p className="sr-only" role="status">{visible.length} products shown</p>
      {visible.length ? <div className={styles.productGrid}>{visible.map(product => <ProductCard key={product._id} product={product}/>)}</div> : <div className={styles.empty}>{products.length ? "No products match your search or category." : "This store has no active products right now."}</div>}
    </div>
  </section>;
}
