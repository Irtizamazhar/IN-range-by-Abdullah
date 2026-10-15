"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";
import { LoaderCircle, Mic, Search, X } from "lucide-react";
import type { SearchItem } from "@/lib/public-search";
import type { ProductCardData } from "@/components/user/ProductCard";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { formatPKR } from "@/lib/format";

type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number };
type BrowserRecognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition };

const labels: Record<SearchItem["kind"], string> = {
  products: "Product", services: "Service", gifts: "Gift", requests: "Public request", stores: "Store", categories: "Category",
};

export function SearchBar() {
  const router = useLoadingRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const routeQuery = pathname?.startsWith("/search") ? params?.get("q") || "" : pathname?.startsWith("/products") ? params?.get("search") || "" : "";
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [startingVoice, setStartingVoice] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [language, setLanguage] = useState("en-PK");
  const [voiceProducts, setVoiceProducts] = useState<ProductCardData[]>([]);
  const [showVoiceProducts, setShowVoiceProducts] = useState(false);
  const [voiceSearching, setVoiceSearching] = useState(false);
  const [voiceSearchError, setVoiceSearchError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const recognition = useRef<BrowserRecognition | null>(null);
  const cancelled = useRef(false);
  const voiceAttempt = useRef(0);
  const voicePending = useRef(false);
  const voiceTranscript = useRef("");
  const voiceProductRequest = useRef<AbortController | null>(null);

  function releaseVoice() {
    voiceAttempt.current += 1;
    voicePending.current = false;
    cancelled.current = true;
    voiceTranscript.current = "";
    try { recognition.current?.stop(); } catch { /* Already stopped. */ }
    recognition.current = null;
    setStartingVoice(false);
    setListening(false);
  }

  useEffect(() => {
    setQuery(routeQuery);
    setOpen(false);
    releaseVoice();
    setVoiceStatus("");
    voiceProductRequest.current?.abort();
    setShowVoiceProducts(false);
    setVoiceProducts([]);
  }, [pathname, routeQuery]);

  useEffect(() => {
    const speech = window as SpeechWindow;
    setVoiceSupported(Boolean(speech.SpeechRecognition || speech.webkitSpeechRecognition));
    const saved = sessionStorage.getItem("joro:voice-language");
    if (saved === "en-PK" || saved === "ur-PK") setLanguage(saved);
    return () => { voiceAttempt.current += 1; cancelled.current = true; voiceProductRequest.current?.abort(); try { recognition.current?.stop(); } catch { /* Already stopped. */ } recognition.current = null; };
  }, []);

  useEffect(() => {
    const onOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) { setItems([]); setBusy(false); setSuggestionError(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Suggestions unavailable");
        const data = await response.json() as { items: SearchItem[] };
        if (!controller.signal.aborted) { setItems(data.items); setSuggestionError(false); }
      } catch { if (!controller.signal.aborted) { setItems([]); setSuggestionError(true); } }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, open]);

  function navigate(text = query) {
    const q = text.trim().slice(0, 100);
    if (!q) { input.current?.focus(); return; }
    setVoiceStatus("");
    setQuery(q);
    setOpen(false);
    setActiveIndex(-1);
    void router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function stopVoice() {
    releaseVoice();
    setVoiceStatus("Voice search stopped");
  }

  async function searchVoiceProducts(transcript: string) {
    voiceProductRequest.current?.abort();
    const controller = new AbortController();
    voiceProductRequest.current = controller;
    setVoiceSearching(true);
    setVoiceSearchError(false);
    setVoiceProducts([]);
    setShowVoiceProducts(true);
    setOpen(false);
    const words = transcript.match(/[^\s,.!?]+/g) || [];
    const stopWords = new Set(["show", "me", "find", "search", "for", "a", "an", "the", "please", "مجھے", "دکھائیں", "تلاش", "کریں"]);
    const fallback = words.filter(word => word.length >= 2 && !stopWords.has(word.toLocaleLowerCase())).sort((a, b) => b.length - a.length)[0];
    try {
      const load = async (search: string) => {
        const response = await fetch(`/api/products?search=${encodeURIComponent(search)}&limit=12`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Product search unavailable");
        const data = await response.json() as { products?: ProductCardData[] };
        return Array.isArray(data.products) ? data.products : [];
      };
      let products = await load(transcript);
      if (!products.length && fallback && fallback.toLocaleLowerCase() !== transcript.toLocaleLowerCase()) products = await load(fallback);
      if (!controller.signal.aborted) setVoiceProducts(products);
    } catch {
      if (!controller.signal.aborted) setVoiceSearchError(true);
    } finally {
      if (!controller.signal.aborted) setVoiceSearching(false);
    }
  }

  function startVoice() {
    if (listening || voicePending.current) { stopVoice(); return; }
    const speech = window as SpeechWindow;
    const Constructor = speech.SpeechRecognition || speech.webkitSpeechRecognition;
    if (!Constructor) { setVoiceStatus("Voice search is not supported in this browser."); return; }
    const attempt = ++voiceAttempt.current;
    voicePending.current = true;
    cancelled.current = false;
    voiceTranscript.current = "";
    setStartingVoice(true);
    setVoiceStatus("");
    voiceProductRequest.current?.abort();
    setShowVoiceProducts(false);
    setOpen(false);
    try {
      const instance = new Constructor();
      recognition.current = instance;
      instance.lang = language;
      instance.continuous = false;
      instance.interimResults = false;
      instance.onresult = (event) => {
        if (cancelled.current || attempt !== voiceAttempt.current) return;
        const transcript = event.results[event.resultIndex]?.[0]?.transcript?.trim();
        if (transcript) { voiceTranscript.current = transcript.slice(0, 100); setQuery(voiceTranscript.current); setOpen(false); setVoiceStatus(""); }
      };
      instance.onerror = (event) => {
        if (cancelled.current || attempt !== voiceAttempt.current) return;
        const messages: Record<string, string> = {
          "not-allowed": "Microphone permission denied. Allow access in your browser site settings.",
          "service-not-allowed": "Speech recognition service unavailable in this browser.",
          "audio-capture": "Microphone unavailable. Check your device.",
          "network": "Speech service network error. Try again.",
          "no-speech": "No speech detected. Try again.",
          "language-not-supported": "This speech language is unavailable. Try English.",
        };
        voiceTranscript.current = "";
        setVoiceStatus(messages[event.error] || "Voice search unavailable. Try again.");
        setListening(false);
      };
      instance.onend = () => {
        if (attempt !== voiceAttempt.current) return;
        setListening(false);
        recognition.current = null;
        const transcript = voiceTranscript.current;
        voiceTranscript.current = "";
        if (!cancelled.current && transcript) { setVoiceStatus(""); void searchVoiceProducts(transcript); }
        else setVoiceStatus(status => status === "Listening..." ? "No speech detected. Try again." : status);
      };
      // Starting inside the click handler keeps browser microphone activation valid.
      instance.start();
      voicePending.current = false;
      setStartingVoice(false);
      setListening(true);
      setVoiceStatus("Listening...");
    } catch {
      if (attempt === voiceAttempt.current) {
        recognition.current = null;
        setListening(false);
        setVoiceStatus("Voice search unavailable. Try again.");
      }
    } finally {
      if (attempt === voiceAttempt.current) {
        voicePending.current = false;
        setStartingVoice(false);
      }
    }
  }

  const suggestions = open && query.trim().length >= 2;
  return <div ref={root} className="relative z-[1000] w-full min-w-0">
    <form role="search" onSubmit={(event) => { event.preventDefault(); navigate(); }} className="flex h-10 min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white transition-colors focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
      <input ref={input} type="search" value={query} onChange={(event) => { if (listening || voicePending.current) releaseVoice(); voiceProductRequest.current?.abort(); setShowVoiceProducts(false); setQuery(event.target.value); setVoiceStatus(""); setOpen(true); setActiveIndex(-1); }} onFocus={() => { if (!showVoiceProducts) setOpen(true); }} onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); setShowVoiceProducts(false); setActiveIndex(-1); return; }
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !showVoiceProducts) { event.preventDefault(); setOpen(true); setActiveIndex((index) => event.key === "ArrowDown" ? Math.min(items.length - 1, index + 1) : Math.max(-1, index - 1)); }
        if (event.key === "Enter" && activeIndex >= 0 && items[activeIndex]) { event.preventDefault(); setOpen(false); void router.push(items[activeIndex].href); }
      }} role="combobox" aria-autocomplete="list" aria-expanded={suggestions} aria-controls="joro-search-options" aria-activedescendant={activeIndex >= 0 ? `joro-search-option-${activeIndex}` : undefined} aria-label="Search JORO marketplace" maxLength={100} autoComplete="off" placeholder="Search products, services, gifts & more..." className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 sm:px-4" />
      {query && <button type="button" onClick={() => { if (listening || voicePending.current) releaseVoice(); voiceProductRequest.current?.abort(); setShowVoiceProducts(false); setQuery(""); setItems([]); setVoiceStatus(""); input.current?.focus(); }} aria-label="Clear search" className="flex w-8 shrink-0 items-center justify-center text-neutral-500 hover:text-emerald-800"><X className="h-4 w-4" /></button>}
      {voiceSupported && <select value={language} onChange={(event) => { setLanguage(event.target.value); sessionStorage.setItem("joro:voice-language", event.target.value); }} aria-label="Voice search language" className="w-11 shrink-0 appearance-none bg-white text-center text-[10px] font-bold text-emerald-900 outline-none"><option value="en-PK">EN</option><option value="ur-PK">UR</option></select>}
      <button type="button" onClick={startVoice} aria-label={!voiceSupported ? "Voice search unavailable in this browser" : listening || startingVoice ? "Stop voice search" : "Start voice search"} aria-pressed={listening} title={!voiceSupported ? "Voice search is not supported in this browser" : listening || startingVoice ? "Tap to stop" : "Search by voice"} className={`flex w-9 shrink-0 items-center justify-center ${listening ? "bg-emerald-100 text-emerald-800" : "text-neutral-500 hover:text-emerald-800"}`}><Mic className="h-4 w-4" /></button>
      <button type="submit" aria-label="Search marketplace" className="flex w-10 shrink-0 items-center justify-center bg-brand-primary text-brand-dark hover:bg-brand-hover md:w-[74px]"><Search className="h-5 w-5 md:hidden" /><span className="hidden text-xs font-bold md:inline">SEARCH</span></button>
    </form>
    {voiceStatus && <span role="status" className="absolute left-1 top-full mt-1 rounded bg-white px-2 py-1 text-xs text-emerald-900 shadow-sm">{voiceStatus}</span>}
    {showVoiceProducts && <div role="region" aria-label="Voice search products" aria-live="polite" className="absolute left-0 top-[44px] max-h-[min(70vh,28rem)] w-full overflow-y-auto rounded-xl border border-emerald-100 bg-white p-2 shadow-xl">
      {voiceSearching ? <p className="flex items-center gap-2 px-3 py-3 text-sm text-neutral-600"><LoaderCircle className="h-4 w-4 animate-spin" /> Searching products...</p> : voiceSearchError ? <p className="px-3 py-3 text-sm text-red-700">Product search unavailable. Please try again.</p> : voiceProducts.length === 0 ? <p className="px-3 py-3 text-sm text-neutral-600">No products found</p> : voiceProducts.map(product => <Link key={product._id} href={product.href || `/products/${encodeURIComponent(product._id)}`} onClick={() => setShowVoiceProducts(false)} className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
        <Image src={product.images?.[0] || "/branding/joro-logo.png"} alt="" width={56} height={56} unoptimized className="h-14 w-14 shrink-0 rounded-lg bg-neutral-50 object-cover" />
        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-emerald-950">{product.name}</span><span className="block text-sm font-bold text-emerald-800">{formatPKR(Number(product.price))}</span></span>
      </Link>)}
    </div>}
    {suggestions && <div id="joro-search-options" role="listbox" aria-label="Search suggestions" className="absolute left-0 top-[44px] max-h-96 w-full overflow-y-auto rounded-xl border border-emerald-100 bg-white p-2 shadow-xl">
      {busy && <p className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Finding matches...</p>}
      {!busy && items.length === 0 && <p className="px-3 py-2 text-xs text-neutral-500">{suggestionError ? "Suggestions unavailable. Press Enter to search." : "No matching public listings yet."}</p>}
      {items.map((item, index) => <button id={`joro-search-option-${index}`} role="option" aria-selected={activeIndex === index} type="button" key={`${item.kind}-${item.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen(false); void router.push(item.href); }} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${activeIndex === index ? "bg-lime-100" : "hover:bg-emerald-50"}`}><span className="min-w-0 truncate font-medium text-emerald-950">{item.title}</span><span className="shrink-0 text-xs text-neutral-500">{labels[item.kind]}</span></button>)}
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => navigate()} className="mt-1 w-full rounded-lg border-t px-3 py-2 text-left text-xs font-bold text-emerald-800 hover:bg-emerald-50">See all results for “{query.trim()}” →</button>
    </div>}
  </div>;
}
