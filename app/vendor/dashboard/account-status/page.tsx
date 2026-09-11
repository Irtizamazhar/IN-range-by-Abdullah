import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";

export const dynamic = "force-dynamic";

export default async function VendorAccountStatusPage() {
  const row = await getVendorFromSession();
  if (!row) redirect("/vendor/login");

  const v = row.vendor;
  const suspended = v.status === "suspended";

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <h1 className="text-2xl font-black text-darkText">Account Status</h1>
      <p className="mt-1 text-sm text-darkText/70">
        Your current status:{" "}
        <span
          className={`font-bold ${
            suspended
              ? "text-red-700"
              : v.status === "approved"
                ? "text-green-700"
                : "text-amber-700"
          }`}
        >
          {v.status}
        </span>
      </p>

      <div className="mt-6 space-y-4">
        <section className="rounded-xl border border-borderGray bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold text-darkText">
            Why an account may be suspended
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-darkText/85">
            <li>Policy violations (fake/replica/prohibited listings)</li>
            <li>Repeated order issues (late shipment or cancellations)</li>
            <li>Unresolved customer complaints/disputes</li>
            <li>Pricing misuse (fake discounts or manipulation)</li>
            <li>Identity/compliance issues (CNIC/business mismatch)</li>
          </ul>
        </section>

        <section className="rounded-xl border border-borderGray bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold text-darkText">How to submit an appeal</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-darkText/85">
            <li>Go to vendor login page.</li>
            <li>Sign in with your account credentials.</li>
            <li>
              If suspended, you will see the <strong>Appeal</strong> section.
            </li>
            <li>Write clear reason and corrective actions taken.</li>
            <li>Submit appeal and wait for admin review decision.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-borderGray bg-amber-50 p-5 shadow-card">
          <h2 className="text-lg font-bold text-amber-900">Important Notes</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900/90">
            <li>Appeals with clear evidence are processed faster.</li>
            <li>Repeated violations can lead to permanent suspension.</li>
            <li>After approval, your account access is restored automatically.</li>
          </ul>
          <a
            href="/vendor/login"
            className="mt-4 inline-block rounded-lg bg-brand-primary px-4 py-2 text-sm font-bold text-brand-dark hover:bg-brand-hover"
          >
            Open Vendor Login / Appeal
          </a>
        </section>
      </div>
    </div>
  );
}
