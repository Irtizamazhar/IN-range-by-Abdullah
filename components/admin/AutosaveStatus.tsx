"use client";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

export function AutosaveStatus({
  state,
  className = "",
}: {
  state: AutosaveState;
  className?: string;
}) {
  if (state === "idle") return null;
  return (
    <p
      className={`text-sm font-medium tabular-nums ${className}`.trim()}
      aria-live="polite"
    >
      {state === "saving" && (
        <span className="text-darkText/60">Saving…</span>
      )}
      {state === "saved" && (
        <span className="text-green-700">All changes saved</span>
      )}
      {state === "error" && (
        <span className="text-red-600">Save failed — check connection</span>
      )}
    </p>
  );
}
