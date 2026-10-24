"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, MapPin, LayoutGrid, X } from "lucide-react";
import { StoreCard, type PublicStore } from "./StoreCard";
import styles from "./StoreDirectory.module.css";

export function StoreDirectory({ stores }: { stores: PublicStore[] }) {
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const counts = useMemo(() => {
    const categories = new Map<string, number>();
    const locations = new Map<string, number>();
    stores.forEach(store => {
      if (store.primaryCategory) categories.set(store.primaryCategory, (categories.get(store.primaryCategory) ?? 0) + 1);
      if (store.city) locations.set(store.city, (locations.get(store.city) ?? 0) + 1);
    });
    return { categories: Array.from(categories).sort(([a], [b]) => a.localeCompare(b)), locations: Array.from(locations).sort(([a], [b]) => a.localeCompare(b)) };
  }, [stores]);
  const visible = useMemo(() => stores.filter(store =>
    (!category || store.primaryCategory === category) &&
    (!location || store.city === location) &&
    store.shopName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [stores, category, location, query]);

  return <main className={styles.page}>
    <header className={styles.heading}>
      <p>Seller network</p>
      <h1>Stores you can trust</h1>
      <div>Discover approved sellers. Explore their products, reviews and latest updates from real marketplace records.</div>
    </header>
    <div className={styles.mobileFilters}>
      <button type="button" aria-expanded={filtersOpen} aria-controls="store-directory-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16}/> Categories &amp; location{(category || location) && <span className={styles.filterDot}/>}</button>
    </div>
    <div className={styles.layout}>
      <aside id="store-directory-filters" className={`${styles.sidebar} ${filtersOpen ? styles.open : ""}`} aria-label="Filter stores">
        <div className={styles.filterHeading}><strong>Filters</strong>{(category || location) && <button type="button" onClick={() => { setCategory(""); setLocation(""); setLocationQuery(""); }}>Clear all</button>}</div>
        <section>
          <h2><LayoutGrid size={15}/> Categories</h2>
          <button type="button" className={styles.filterRow} aria-pressed={!category} onClick={() => setCategory("")}><span>All Categories</span><small>({stores.length})</small></button>
          {counts.categories.map(([name, count]) => <button type="button" key={name} className={styles.filterRow} aria-pressed={category === name} onClick={() => setCategory(name)}><span>{name}</span><small>({count})</small></button>)}
        </section>
        <section>
          <h2><MapPin size={15}/> Location</h2>
          <label className={styles.locationSearch}><Search size={14}/><span className="sr-only">Search locations</span><input value={locationQuery} onChange={event => setLocationQuery(event.target.value)} placeholder="Search locations..." type="search"/></label>
          <button type="button" className={styles.filterRow} aria-pressed={!location} onClick={() => setLocation("")}><span>All Locations</span><small>({stores.length})</small></button>
          {counts.locations.filter(([name]) => name.toLocaleLowerCase().includes(locationQuery.trim().toLocaleLowerCase())).map(([name, count]) => <button type="button" key={name} className={styles.filterRow} aria-pressed={location === name} onClick={() => setLocation(name)}><span>{name}</span><small>({count})</small></button>)}
        </section>
      </aside>
      <section className={styles.content} aria-label="Store results">
        <div className={styles.toolbar}>
          <label className={styles.search}><Search size={17}/><span className="sr-only">Search stores</span><input type="search" placeholder="Search stores..." value={query} onChange={event => setQuery(event.target.value)}/></label>
          <p role="status">{visible.length} {visible.length === 1 ? "store" : "stores"}</p>
        </div>
        {(category || location) && <div className={styles.selected}>{category && <button type="button" onClick={() => setCategory("")}>{category}<X size={13}/><span className="sr-only">Clear category</span></button>}{location && <button type="button" onClick={() => setLocation("")}>{location}<X size={13}/><span className="sr-only">Clear location</span></button>}</div>}
        {visible.length ? <div className={styles.grid}>{visible.map(store => <StoreCard key={store.id} store={store}/>)}</div> : <div className={styles.empty}><h2>{stores.length ? "No matching stores" : "Stores are on their way"}</h2><p>{stores.length ? "Try another store name or clear your filters." : "Approved stores will appear here."}</p>{stores.length > 0 && <button type="button" onClick={() => { setQuery(""); setCategory(""); setLocation(""); }}>Reset search and filters</button>}</div>}
      </section>
    </div>
  </main>;
}
