"use client";

import { useEffect, useState } from "react";

export function PreviewExitControl() {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/preview-access/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(response => response.ok ? response.json() : { active: false })
      .then(data => { if (!controller.signal.aborted) setActive(data.active === true); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!active) return null;
  return <div className="fixed bottom-4 right-4 z-[2147483001] flex flex-col items-end gap-2">
    {error && <p role="alert" className="rounded bg-white px-3 py-2 text-sm text-red-700 shadow-lg">Could not exit preview. Please try again.</p>}
    <button
    type="button"
    disabled={busy}
    onClick={async () => {
      setError(false);
      setBusy(true);
      try {
        const response = await fetch("/api/preview-access/logout", { method: "POST", credentials: "same-origin" });
        if (!response.ok) throw new Error("Logout failed");
        window.location.assign("/");
      } catch {
        setError(true);
        setBusy(false);
      }
    }}
    className="rounded-full bg-[#005235] px-4 py-2 text-sm font-bold text-white shadow-lg focus:outline-none focus:ring-4 focus:ring-[#B5E637] disabled:opacity-60"
  >{busy ? "Exiting preview…" : "Exit Preview"}</button>
  </div>;
}
