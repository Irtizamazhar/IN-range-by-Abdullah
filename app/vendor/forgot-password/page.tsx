import Link from "next/link";

const accent = "#F59E0B";

export const metadata = {
  title: "Forgot password | Vendor",
};

export default function VendorForgotPasswordPage() {
  return (
    <div className="min-h-screen px-4 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-neutral-900">
          Reset password
        </h1>
        <p className="mt-3 text-sm text-neutral-600">
          Self-service password reset for vendors is not enabled yet. Please
          contact marketplace support with your registered email and shop name,
          and we will help you regain access.
        </p>
        <Link
          href="/vendor/login"
          className="mt-8 inline-block font-bold hover:underline"
          style={{ color: accent }}
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
