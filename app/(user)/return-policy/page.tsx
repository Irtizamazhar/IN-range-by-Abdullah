import Link from "next/link";

export default function ReturnPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-yellow-400">Return Policy</h1>
      <p className="mt-2 text-sm text-darkText/60">
        Returns aur exchanges ke liye yeh guidelines follow karein taake aapka case jald resolve ho
        sake.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-xl border border-sky-100 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">General policy</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-darkText/80">
            <li>
              <strong>Parcel opening video zaroori hai:</strong> claim ke liye package kholte waqt
              clear video banayein — iske baghair replacement/refund process start nahi ho sakta.
            </li>
            <li>
              Delivery ke baad <strong>7 din</strong> ke andar humein return/exchange ke liye inform
              karein. Is duration ke baad requests accept nahi ki jati.
            </li>
            <li>
              Free delivery offer (jaise orders above <strong>Rs. 3,000</strong>) alag se policy ke
              mutabiq hota hai; return par original order terms apply hote hain.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-sky-100 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">Return process</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-darkText/80">
            <li>
              Item wapas bhejne ke liye <strong>traceable courier</strong> (tracking number wala)
              use karein. Courier charges customer ki taraf se honge.
            </li>
            <li>
              Order par lagi <strong>delivery charges refundable nahi</strong> hoti, sirf product
              amount ke mutabiq settlement hota hai jahan policy allow karti ho.
            </li>
            <li>
              Hum product receive karne ke baad <strong>2 working days</strong> ke andar refund /
              exchange status update karte hain (verification ke baad).
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-sky-100 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">Valid situations</h2>
          <p className="mt-2 text-sm text-darkText/80">
            Return/exchange sirf in surton mein consider hota hai:
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-darkText/80">
            <li>
              <strong>Wrong product</strong> deliver ho (jo order kiya tha woh na ho).
            </li>
            <li>
              Product mein <strong>defect / damage / issue</strong> ho aur opening video se sabit ho.
            </li>
          </ol>
          <p className="mt-3 text-sm text-darkText/70">
            Size, colour preference, ya &ldquo;mind change&rdquo; wale cases policy ke mutabiq handle
            hote hain — pehle WhatsApp par team se confirm kar lein.
          </p>
        </section>

        <section className="rounded-xl border border-sky-100 border-t-4 border-t-yellow-400 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">How to return</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-darkText/80">
            <li>
              <strong>WhatsApp</strong> ya email par order number, issue ki detail aur parcel opening
              video share karein.
            </li>
            <li>
              Team aapko <strong>return office address</strong> aur further steps degi.
            </li>
            <li>
              Product ko <strong>waisa hi pack</strong> karein jaisa receive hua tha (tags/box jahan
              mumkin ho).
            </li>
          </ol>
          <p className="mt-4 text-sm">
            <Link
              href="/track-order"
              className="font-semibold text-sky-600 underline-offset-2 hover:underline"
            >
              Track Order
            </Link>
            {" · "}
            <Link href="/faq" className="font-semibold text-sky-600 underline-offset-2 hover:underline">
              FAQ
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
