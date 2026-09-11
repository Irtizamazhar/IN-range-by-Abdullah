"use client";

export function VendorFlagsList({ flags }: { flags: string[] }) {
  if (!flags.length) {
    return (
      <div className="rounded-xl border border-borderGray bg-white p-4 text-sm text-darkText/60">
        No risk flags triggered.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-borderGray bg-white p-4 shadow-card">
      <p className="mb-3 text-sm font-bold text-darkText">Triggered Flags</p>
      <div className="flex flex-wrap gap-2">
        {flags.map((f, i) => {
          const isRed = /high|low|violation/i.test(f);
          return (
            <span
              key={`${f}-${i}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isRed
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {f}
            </span>
          );
        })}
      </div>
    </div>
  );
}
