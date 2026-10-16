"use client";

import { useId, useMemo, useState, type InputHTMLAttributes } from "react";
import { PAKISTANI_CITIES } from "@/lib/pakistani-cities";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "defaultValue"> & { value?: string; defaultValue?: string; onValueChange?: (value: string) => void; wrapperClassName?: string };

/** Searchable city combobox; custom/legacy names remain valid plain strings. */
export function PakistanCitySelect({ value: controlled, defaultValue = "", onValueChange, className = "", wrapperClassName = "", onBlur, onKeyDown, onFocus, ...props }: Props) {
  const [local, setLocal] = useState(defaultValue);
  const value = controlled ?? local;
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const id = useId(), listId = `${id}-cities`;
  const matches = useMemo(() => PAKISTANI_CITIES.filter(city => city.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase())).slice(0, 60), [value]);
  const custom = value.trim() && !PAKISTANI_CITIES.some(city => city.toLocaleLowerCase() === value.trim().toLocaleLowerCase());
  const options = custom ? [...matches, value.trim()] : matches;
  function change(next: string) { setLocal(next); onValueChange?.(next); }
  function select(next: string) { change(next); setOpen(false); setActive(-1); }
  return <span className={`relative block min-w-0 ${wrapperClassName}`}>
    <input {...props} aria-label={props["aria-label"] || "City"} value={value} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open && active >= 0 && active < options.length ? `${id}-city-${active}` : undefined} placeholder={props.placeholder || "Search city or town"} className={`h-12 w-full min-w-0 rounded-xl border border-neutral-300 bg-white px-3 pr-9 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 ${className}`} onFocus={event => { onFocus?.(event); setOpen(true); }} onClick={() => setOpen(true)} onChange={event => { change(event.target.value); setOpen(true); setActive(-1); }} onBlur={event => { setOpen(false); setActive(-1); onBlur?.(event); }} onKeyDown={event => {
      onKeyDown?.(event); if (event.defaultPrevented) return;
      if (event.key === "Escape") { if (open) { event.preventDefault(); event.stopPropagation(); } setOpen(false); }
      else if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); const next = event.key === "ArrowDown" ? Math.min(active + 1, options.length - 1) : Math.max(active - 1, 0); setActive(next); document.getElementById(`${id}-city-${next}`)?.scrollIntoView({ block: "nearest" }); }
      else if (event.key === "Enter" && open) { event.preventDefault(); if (active >= 0 && options[active]) select(options[active]); else setOpen(false); }
    }} />
    <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">⌄</span>
    {open && <span id={listId} role="listbox" aria-label="Pakistan cities" className="absolute inset-x-0 top-full z-40 mt-1 block max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
      {!matches.length && <span role="status" className="block px-3 py-3 text-sm font-normal text-neutral-500">No matching cities. You can keep your city name.</span>}
      {options.map((city, index) => <span role="option" aria-selected={active >= 0 ? active === index : value === city} id={`${id}-city-${index}`} key={city} onMouseDown={event => event.preventDefault()} onClick={() => select(city)} className={`block cursor-pointer break-words px-3 py-2.5 text-sm font-normal text-neutral-800 hover:bg-neutral-50 ${active === index ? "bg-emerald-50" : ""}`}>{custom && index === options.length - 1 ? `Use “${city}”` : city}</span>)}
    </span>}
  </span>;
}
