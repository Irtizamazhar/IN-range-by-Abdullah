"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "Order place karne ke baad confirmation kab milti hai?",
    a: "Order place hote hi aapko order number milta hai. Team verification ke baad status Confirmed ho jata hai.",
  },
  {
    q: "Cash on Delivery kis city mein available hai?",
    a: "COD selected cities mein available hai. Checkout par city select karte hi system batata hai COD allowed hai ya nahi.",
  },
  {
    q: "Bank transfer payment proof kaise upload karun?",
    a: "Checkout mein Bank Transfer select karein, screenshot upload karein, phir Place Order karein. Proof receive hote hi verification start ho jati hai.",
  },
  {
    q: "Order track kaise karun?",
    a: "Track Order page par apna order number (IRB-xxx) likhein aur Track button par click karein. Aapko timeline mein current status mil jayega.",
  },
  {
    q: "Order cancel kab tak ho sakta hai?",
    a: "Order pending/confirmed/processing status mein ho to cancel ho sakta hai. Packing ya shipped ke baad cancellation allowed nahi hoti.",
  },
  {
    q: "Product return/exchange policy kya hai?",
    a: "Agar product damaged ya wrong receive ho to WhatsApp support se contact karein. Team case check karke return/exchange process guide karti hai.",
  },
  {
    q: "Customer review dene ka best tareeqa kya hai?",
    a: "Best tareeqa: review sirf delivered order ke baad allow karein. Isse genuine reviews milte hain aur fake review ka chance kam hota hai.",
  },
];

export default function FaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-yellow-400">Frequently Asked Questions</h1>
      <p className="mt-2 text-sm text-darkText/60">
        Sawalat par click karein, neeche detailed jawab open ho jayega.
      </p>

      <div className="mt-8 space-y-3">
        {FAQS.map((item, idx) => {
          const open = openIdx === idx;
          return (
            <div
              key={item.q}
              className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-card"
            >
              <button
                type="button"
                onClick={() => setOpenIdx((prev) => (prev === idx ? null : idx))}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="font-semibold text-darkText">{item.q}</span>
                <span className="ml-4 text-sky-500">{open ? "−" : "+"}</span>
              </button>
              {open ? (
                <div className="border-t border-sky-100 px-4 py-3 text-sm leading-6 text-darkText/80">
                  {item.a}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
