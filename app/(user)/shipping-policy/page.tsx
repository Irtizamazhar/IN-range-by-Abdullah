import Link from "@/components/ui/LoadingLink";
import { JsonLd } from "@/components/seo/JsonLd";
import { readMerchantShipping } from "@/lib/merchant-shipping";
import { organizationSchema, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Shipping Information", "View current JORO.PK checkout delivery charges and eligible COD cities.", "/shipping-policy");
export const dynamic = "force-dynamic";

export default async function ShippingPolicyPage() {
  const shipping = await readMerchantShipping();
  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-10">
    <JsonLd data={organizationSchema()} />
    <h1 className="text-3xl font-bold">Shipping Information</h1>
    <p>Standard catalog checkout uses the current shop-wide delivery charge, once per order.</p>
    {shipping ? <>
      <p>Delivery charge: <strong>PKR {shipping.fee.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.</p>
      <p>Cash on Delivery is available in: {shipping.cities.length ? shipping.cities.join(", ") : "no cities currently configured"}.</p>
    </> : <p>Current delivery settings are unavailable. Confirm the delivery charge and eligible city at checkout before placing an order.</p>}
    <p>Accepted private quotes use their separately agreed shipping charge and delivery terms. Their shipping is not covered by the standard catalog charge above.</p>
    <p>Confirm delivery arrangements for your order with support. This page does not promise a handling or delivery time.</p>
    <Link href="/return-policy" className="font-semibold underline">Return policy</Link>
  </main>;
}
