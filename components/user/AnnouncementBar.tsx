"use client";

const MESSAGES = [
  "🚚 Enjoy FREE Delivery on Orders Above Rs.3,000",
  "⭐ Pakistan's #1 Budget Shop",
  "✅ Cash on Delivery Available",
  "🔄 Easy Returns & Exchanges",
];

function MessageRow() {
  return (
    <>
      {MESSAGES.map((message, idx) => (
        <span key={`${message}-${idx}`} className="inline-flex items-center">
          <span>{message}</span>
          {idx < MESSAGES.length - 1 ? (
            <span className="mx-4 text-white/90">•</span>
          ) : null}
        </span>
      ))}
    </>
  );
}

export function AnnouncementBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-8 w-full max-w-[100vw] overflow-hidden bg-[#F2AB22] text-white">
      <div className="marquee-track flex h-full w-max items-center whitespace-nowrap text-xs font-medium uppercase tracking-[0.08em]">
        <div className="inline-flex items-center pr-8">
          <MessageRow />
        </div>
        <div className="inline-flex items-center pr-8" aria-hidden="true">
          <MessageRow />
        </div>
      </div>
    </div>
  );
}
