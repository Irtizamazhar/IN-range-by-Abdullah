"use client";
import { useEffect, useId, useState } from "react";
import type { ServiceCoverage, ServicePlace } from "@/lib/service-coverage";

export function LocationSearch({ city, label, onSelect }: { city?: ServicePlace; label: string; onSelect: (place: ServicePlace) => void }) {
  const [query, setQuery] = useState(""); const [rows, setRows] = useState<ServicePlace[]>([]); const [message, setMessage] = useState("");
  const id = useId(); const cityKey = city ? JSON.stringify(city) : "";
  useEffect(() => {
    setRows([]); if (query.trim().length < 2) { setMessage(""); return; }
    const abort = new AbortController(); setMessage("Searching verified locations…");
    const timer = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ q: query.trim() }); if (cityKey) q.set("city", cityKey);
        const response = await fetch(`/api/services/locations?${q}`, { signal: abort.signal }); const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not search locations.");
        setRows(data.locations); setMessage(data.locations.length ? "" : "No verified locations found. Try another spelling or request a location review. Coverage is incomplete in some places.");
      } catch (error) { if (!abort.signal.aborted) setMessage(error instanceof Error ? error.message : "Location search unavailable."); }
    }, 400);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query, cityKey]);
  return <div className="min-w-0"><label htmlFor={id} className="block text-sm font-semibold">{label}</label><input id={id} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={city ? `Search areas in ${city.name}` : "Search Pakistan cities or towns"} className="mt-1 w-full min-w-0 rounded-xl border bg-white p-3" autoComplete="off" aria-describedby={`${id}-status`} />
    {message && <p id={`${id}-status`} role="status" className="mt-1 text-xs text-gray-600">{message}</p>}
    {!!rows.length && <ul aria-label={`${label} results`} className="mt-1 max-h-52 overflow-y-auto rounded-xl border bg-white p-1 shadow-sm">{rows.map(row => <li key={row.id}><button type="button" className="w-full break-words rounded-lg p-2 text-left text-sm hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-700" onClick={() => { onSelect(row); setQuery(""); setRows([]); }}><strong>{row.name}</strong><span className="block text-xs text-gray-500">{row.kind} · {row.label}</span></button></li>)}</ul>}
  </div>;
}
export function LocationAttribution() { return <p className="mt-3 text-xs text-gray-500">Powered by <a href="https://www.geoapify.com/" className="underline">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" className="underline">OpenStreetMap contributors</a>. Only verified search results can be selected.</p>; }
export function ServiceCoverageSelector({ value, onChange }: { value: ServiceCoverage; onChange: (coverage: ServiceCoverage) => void }) {
  return <fieldset className="min-w-0 rounded-2xl border bg-emerald-50/40 p-4"><legend className="px-2 font-bold">Coverage cities and areas</legend>
    {value.some(row => row.city.proof?.version !== 2 || row.areas.some(area => area.proof?.version !== 2)) && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Your saved coverage is preserved. Search and replace older city/area selections before resubmitting; they need the updated geographic verification.</p>}
    <LocationSearch label="Add coverage city" onSelect={city => { if (!value.some(row => row.city.id === city.id)) onChange([...value, { city, entireCity: false, areas: [] }]); }} />
    <div className="mt-3 flex flex-wrap gap-2">{value.map(row => <span key={row.city.id} className="rounded-full bg-[#005055] px-3 py-1 text-sm text-white">{row.city.name} <button type="button" aria-label={`Remove ${row.city.name}`} onClick={() => onChange(value.filter(item => item.city.id !== row.city.id))}>×</button></span>)}</div>
    {value.map((row, index) => <details key={row.city.id} open className="mt-3 min-w-0 rounded-xl border bg-white p-3"><summary className="cursor-pointer break-words font-semibold">{row.city.name} — {row.entireCity ? "Entire city" : `${row.areas.length} selected areas`}</summary><p className="mt-1 break-words text-xs text-gray-500">{row.city.label}</p>
      <label className="my-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={row.entireCity} onChange={e => onChange(value.map((item, i) => i === index ? { ...item, entireCity: e.target.checked, areas: [] } : item))} />Covers Entire City — select only if you serve the whole city</label>
      {!row.entireCity && <><LocationSearch city={row.city} label={`Add area in ${row.city.name}`} onSelect={area => { if (!row.areas.some(a => a.id === area.id || a.name.toLowerCase() === area.name.toLowerCase())) onChange(value.map((item, i) => i === index ? { ...item, areas: [...item.areas, area] } : item)); }} /><div className="mt-2 flex flex-wrap gap-2">{row.areas.map(area => <span key={area.id} className="max-w-full break-words rounded-full bg-lime-100 px-3 py-1 text-sm">{area.name} <button type="button" aria-label={`Remove ${area.name}`} onClick={() => onChange(value.map((item, i) => i === index ? { ...item, areas: item.areas.filter(a => a.id !== area.id) } : item))}>×</button></span>)}</div>{!row.areas.length && <p className="mt-2 text-xs text-amber-800">Choose at least one verified area or explicitly cover the entire city.</p>}</>}
    </details>)}<LocationAttribution />
  </fieldset>;
}
