"use client";

const MESSAGES = [
  "A Stronger Pakistan Together",
  "Support Local",
  "Shop Pakistani",
  "Grow Together",
  "Nationwide Delivery",
  "Secure Payments",
  "Verified Sellers",
];

function MessageRow() {
  return (
    <>
      {MESSAGES.map((message, index) => (
        <span key={`${message}-${index}`} className="inline-flex items-center">
          <span>{message}</span>
          {index < MESSAGES.length - 1 ? (
            <span className="mx-5 h-1 w-1 rounded-full bg-white/45" />
          ) : null}
        </span>
      ))}
    </>
  );
}

export function AnnouncementBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-8 overflow-hidden bg-[#123d27] text-white">
      <div className="marquee-track flex h-full w-max items-center whitespace-nowrap text-[9px] font-extrabold uppercase tracking-[0.08em] sm:text-[10px]">
        <div className="inline-flex items-center pr-10">
          <MessageRow />
        </div>

        <div className="inline-flex items-center pr-10" aria-hidden="true">
          <MessageRow />
        </div>
      </div>
    </div>
  );
}