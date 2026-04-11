import { notFound, redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";
import { VendorProductForm } from "@/components/vendor/VendorProductForm";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

export default async function VendorEditProductPage({ params }: Props) {
  const row = await getVendorFromSession();
  if (!row) {
    redirect("/vendor/login");
  }
  if (row.vendor.status !== "approved") {
    redirect("/vendor/dashboard/products");
  }

  const p = await prisma.vendorProduct.findFirst({
    where: { id: params.id, vendorId: row.vendor.id },
  });
  if (!p) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <VendorProductForm
        mode="edit"
        productId={p.id}
        initial={{
          productName: p.productName,
          description: p.description,
          price: p.price.toString(),
          category: p.category,
          stock: p.stock,
          images: p.images,
          status: p.status,
        }}
      />
    </div>
  );
}
