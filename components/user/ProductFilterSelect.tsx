"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string };

/** Anchored below the field instead of using the OS-controlled select popup. */
export function ProductFilterSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [maxHeight, setMaxHeight] = useState(256);
  const selected = Math.max(0, options.findIndex((option) => option.value === value));

  function show() {
    const button = trigger.current;
    if (!button) return;
    // Leave room above the fixed mobile navigation, while always opening below.
    const bottomInset = window.innerWidth < 768 ? 88 : 16;
    if (window.innerHeight - button.getBoundingClientRect().bottom - bottomInset < 160) {
      button.scrollIntoView({ block: "center", behavior: "instant" });
    }
    setMaxHeight(Math.max(80, Math.min(256, window.innerHeight - button.getBoundingClientRect().bottom - bottomInset - 8)));
    setActive(selected);
    search.current = { text: "", time: 0 };
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
    if (option.value !== value) onChange(option.value);
  }

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function resize() { setOpen(false); }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const option = list.current?.children[active] as HTMLElement | undefined;
    const menu = list.current;
    if (!option || !menu) return;
    if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
    }
  }, [open, active]);

  return (
    <div ref={root} className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-options`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-borderGray bg-white px-3 py-2.5 text-left text-sm text-darkText shadow-sm focus-visible:border-primaryBlue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primaryBlue/20"
        onClick={() => open ? setOpen(false) : show()}
        onKeyDown={(event) => {
          if (event.key === "Tab") { setOpen(false); return; }
          if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
          if (["Enter", " ", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            if (!open) { show(); return; }
            if (event.key === "Enter" || event.key === " ") choose(active);
            else if (event.key === "Home") setActive(0);
            else if (event.key === "End") setActive(options.length - 1);
            else setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            if (!open) show();
            const now = Date.now();
            const text = (now - search.current.time < 700 ? search.current.text : "") + event.key.toLowerCase();
            search.current = { text, time: now };
            const match = options.findIndex((option) => option.label.toLowerCase().startsWith(text));
            if (match >= 0) setActive(match);
          }
        }}
      >
        <span className="truncate">{options[selected]?.label}</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute left-0 top-full z-30 mt-2 w-full overflow-y-auto overscroll-contain rounded-xl border border-borderGray bg-white p-1 shadow-lg"
          style={{ maxHeight }}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm text-darkText ${index === active ? "bg-brand-soft" : "hover:bg-brand-soft"}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span className="min-w-0 break-words">{option.label}</span>
              {option.value === value && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-link" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
