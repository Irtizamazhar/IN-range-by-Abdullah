import { notFound, redirect } from "next/navigation";
import { PrintInvoiceButton } from "@/components/user/PrintInvoiceButton";
import { formatPKR } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/sessions";
import { storedOrderBreakdown } from "@/lib/stored-order-breakdown";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: { orderId: string } }) {
  const session = await getCustomerSession();
  if (session?.user?.role !== "customer" || !session.user.id) redirect("/account");
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, customerId: session.user.id },
    include: { orderItems: true, services: true, couponRedemption: true, refunds: { where: { status: "processed" } } },
  });
  if (!order) notFound();

  const { productSubtotal, serviceSubtotal, discount, handlingFee, delivery, total } = storedOrderBreakdown(order);
  const refunded = order.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 print:max-w-none print:bg-white print:p-0">
      <section className="rounded-2xl border border-borderGray bg-white p-6 shadow-card sm:p-9 print:border-0 print:shadow-none">
        <div className="flex flex-col gap-5 border-b border-borderGray pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-brand-link">InRange by Abdullah</p>
            <h1 className="mt-1 text-3xl font-black text-brand-dark">Invoice</h1>
            <p className="mt-2 text-sm text-darkText/55">Invoice {order.orderNumber}</p>
          </div>
          <PrintInvoiceButton />
        </div>

        <div className="grid gap-5 border-b border-borderGray py-6 text-sm sm:grid-cols-2">
          <div><p className="font-bold text-darkText/45">Billed to</p><p className="mt-1 font-black text-brand-dark">{order.customerName}</p><p className="mt-1 leading-6 text-darkText/65">{order.customerAddress}, {order.city}<br />{order.customerPhone}<br />{order.customerEmail}</p></div>
          <div className="sm:text-right"><p className="font-bold text-darkText/45">Order details</p><p className="mt-1 text-darkText/70">Issued {order.createdAt.toLocaleDateString("en-PK", { dateStyle: "long" })}</p><p className="mt-1 capitalize text-darkText/70">Payment: {order.paymentMethod.replaceAll("_", " ")} · {order.paymentStatus.replaceAll("_", " ")}</p></div>
        </div>

        <div className="overflow-x-auto py-6">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead><tr className="border-b border-borderGray text-darkText/45"><th className="py-3">Item</th><th className="py-3">Qty</th><th className="py-3 text-right">Unit price</th><th className="py-3 text-right">Total</th></tr></thead>
            <tbody>{[...order.orderItems, ...order.services.map(service => ({ id: service.id, name: String((service.snapshot as { name?: string } | null)?.name || "Booked service"), price: service.price, quantity: service.quantity, variant: null }))].map((item) => <tr key={item.id} className="border-b border-borderGray/70"><td className="py-4"><p className="font-bold text-brand-dark">{item.name}</p>{item.variant ? <p className="mt-0.5 text-xs text-darkText/50">{item.variant}</p> : null}</td><td className="py-4">{item.quantity}</td><td className="py-4 text-right">{formatPKR(Number(item.price))}</td><td className="py-4 text-right font-bold">{formatPKR(Number(item.price) * item.quantity)}</td></tr>)}</tbody>
          </table>
        </div>

        <dl className="ml-auto max-w-sm space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-darkText/55">Product subtotal</dt><dd>{formatPKR(productSubtotal)}</dd></div>
          {serviceSubtotal > 0 && <div className="flex justify-between"><dt className="text-darkText/55">Booked services</dt><dd>{formatPKR(serviceSubtotal)}</dd></div>}
          {discount > 0 && <div className="flex justify-between"><dt className="text-darkText/55">Discount</dt><dd>-{formatPKR(discount)}</dd></div>}
          {handlingFee > 0 && <div className="flex justify-between"><dt className="text-darkText/55">Handling Fee</dt><dd>{formatPKR(handlingFee)}</dd></div>}
          <div className="flex justify-between"><dt className="text-darkText/55">Delivery Charges{handlingFee === 0 ? <span className="block text-xs">Includes applicable fulfilment and handling</span> : null}</dt><dd>{formatPKR(delivery)}</dd></div>
          <div className="flex justify-between border-t border-borderGray pt-3 text-base font-black text-brand-dark"><dt>Order total</dt><dd>{formatPKR(total)}</dd></div>
          {refunded > 0 ? <div className="flex justify-between font-bold text-emerald-700"><dt>Refunded</dt><dd>-{formatPKR(refunded)}</dd></div> : null}
        </dl>
        <p className="mt-8 rounded-xl bg-brand-soft/60 p-4 text-xs leading-5 text-darkText/60">This invoice is generated from the stored JORO order. Refund references and updated payment status remain part of the order audit history.</p>
      </section>
    </main>
  );
}
