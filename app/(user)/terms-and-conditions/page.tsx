import Link from "next/link";

export default function TermsAndConditionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-yellow-400">Terms & Conditions</h1>
      <p className="mt-2 text-sm text-darkText/60">
        In Range By Abdullah use karte waqt neeche di gayi terms apply hoti hain.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-xl border border-sky-100 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">1) Order acceptance</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-darkText/80">
            <li>Order place hona final dispatch guarantee nahi hota.</li>
            <li>
              Availability, verification, ya technical issue ki surat mein order cancel/hold kiya ja sakta
              hai.
            </li>
            <li>Team zarurat par customer se confirmation ke liye contact kar sakti hai.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-sky-100 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">2) Pricing and payments</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-darkText/80">
            <li>Prices bina prior notice update ho sakte hain.</li>
            <li>Delivery charges checkout par selected location ke mutabiq apply hoti hain.</li>
            <li>
              Bank transfer orders ke liye payment proof required hai; verification ke baad hi order process
              hota hai.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-sky-100 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">3) Shipping and delivery</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-darkText/80">
            <li>Estimated delivery time city aur courier conditions par depend karti hai.</li>
            <li>
              Delay (weather, strikes, courier backlog) ki صورت mein store liable nahi hoga, lekin support
              assist karegi.
            </li>
            <li>Customer ka sahi address aur contact number dena zaroori hai.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-sky-100 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">4) Returns and claims</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-darkText/80">
            <li>Return/exchange policy separate page ke mutabiq process hoti hai.</li>
            <li>
              Damage/wrong item claim ke liye parcel opening video aur order details provide karna lazmi hai.
            </li>
            <li>Final decision documented evidence aur policy rules ke basis par hota hai.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-sky-100 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">5) Account and conduct</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-darkText/80">
            <li>Fake information ya misuse ki surat mein account restrict/suspend kiya ja sakta hai.</li>
            <li>Store fraud prevention ke liye suspicious orders ko review/cancel kar sakta hai.</li>
            <li>Users platform par abusive ya illegal activity se parhez karein.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-sky-100 border-t-4 border-t-yellow-400 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">6) Contact and updates</h2>
          <p className="mt-3 text-sm leading-relaxed text-darkText/80">
            Yeh terms time to time update ho sakti hain. Latest version hamesha isi page par available hogi.
            Kisi bhi query ke liye support se contact karein.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/faq" className="font-semibold text-sky-600 underline-offset-2 hover:underline">
              FAQ
            </Link>
            {" · "}
            <Link
              href="/return-policy"
              className="font-semibold text-sky-600 underline-offset-2 hover:underline"
            >
              Return Policy
            </Link>
            {" · "}
            <Link
              href="/track-order"
              className="font-semibold text-sky-600 underline-offset-2 hover:underline"
            >
              Track Order
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
