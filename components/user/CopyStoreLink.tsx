"use client";

import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";

export function CopyStoreLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard API unavailable (e.g. insecure context) -- the link text is still visible/selectable. */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex max-w-full items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/[0.1]"
      title="Copy shareable store link"
    >
      {copied ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Share2 className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{url}</span>
      {!copied && <Copy className="h-3 w-3 shrink-0 opacity-60" />}
    </button>
  );
}
