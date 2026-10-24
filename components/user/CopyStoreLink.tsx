"use client";
import toast from "react-hot-toast";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import styles from "./StoreProfile.module.css";

export function CopyStoreLink({ url, title }: { url: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    const storeUrl = new URL(url, window.location.origin).href;
    if (navigator.share) {
      try {
        await navigator.share({ title: title || "JORO Store", url: storeUrl });
        toast.success("Store link shared.");
        return;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return;
        // Some desktop browsers expose share but cannot open a share sheet.
      }
    }
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast.success("Store link copied.");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link. Select and copy the store address manually.");
    }
  }

  return (
    <LoadingButton
      type="button"
      loadingLabel="Sharing..."
      onClick={() => copy()}
      className={styles.share}
      title="Share or copy store link"
    >
      {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
      {copied ? "Link copied" : "Share"}
    </LoadingButton>
  );
}
