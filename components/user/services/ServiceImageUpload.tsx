"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ServiceImage } from "./ServiceImage";
import { SERVICE_IMAGE_MAX_BYTES } from "@/lib/service-image-policy";

export function ServiceImageUpload({ value, defaultImageUrl, onChange, uploadUrl, label, disabled = false, onBusyChange }: {
  value: string | null; defaultImageUrl?: string | null; onChange: (value: string | null) => void;
  uploadUrl: string; label: string; disabled?: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const controller = useRef<AbortController>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  return <fieldset disabled={disabled || busy} aria-busy={busy} className="min-w-0 rounded-2xl border border-[#005055]/20 p-4 text-[#005055]">
    <legend className="px-2 font-semibold">{label}</legend>
    <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,240px)_1fr]">
      <ServiceImage imageUrl={value} defaultImageUrl={defaultImageUrl} alt={label} sizes="(max-width: 640px) 100vw, 240px" />
      <div className="min-w-0 space-y-3"><p id={`${id}-help`} className="text-sm text-gray-600">JPG, PNG or WebP, up to 5MB. A landscape image works best. Existing files are retained when replaced or removed.</p>
        <input ref={input} id={id} type="file" accept="image/jpeg,image/png,image/webp" aria-label={label} aria-describedby={`${id}-help`} className="block w-full min-w-0 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-[#B8E632] file:px-3 file:py-2 file:font-bold file:text-[#005055]" onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (!file) return; setError(""); setMessage("");
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > SERVICE_IMAGE_MAX_BYTES) { setError("Choose a JPG, PNG or WebP image up to 5MB."); return; }
          setBusy(true); onBusyChange(true); controller.current = new AbortController();
          const timeout = setTimeout(() => controller.current?.abort(), 60_000);
          try {
            const form = new FormData(); form.set("file", file);
            const response = await fetch(uploadUrl, { method: "POST", body: form, credentials: "same-origin", signal: controller.current.signal });
            const data = await response.json();
            if (!response.ok || typeof data.url !== "string") throw new Error(data.error || "Could not upload the image.");
            if (mounted.current) { onChange(data.url); setMessage("Image uploaded. Save the service to apply it."); }
          } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "Could not upload the image."); }
          finally { clearTimeout(timeout); if (mounted.current) { setBusy(false); onBusyChange(false); } }
        }} />
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => input.current?.click()} className="rounded-xl border px-3 py-2 text-sm font-bold">{value ? "Replace image" : "Choose image"}</button>
          {value && <button type="button" onClick={() => { onChange(null); setError(""); setMessage(defaultImageUrl ? "Custom image removed. The catalog default will be used after saving." : "Image removed. Save the service to apply it."); }} className="rounded-xl border px-3 py-2 text-sm">Remove image</button>}</div>
        {disabled && <p className="text-sm">Select a provider and finish saving before editing the image.</p>}
        {busy && <p role="status" className="text-sm">Uploading image…</p>}{message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  </fieldset>;
}
