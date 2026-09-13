import { prisma } from "@/lib/prisma";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { serializeProduct } from "@/lib/serialize";
export async function customerSavedProducts(customerId: string) {
  const rows = await prisma.savedProduct.findMany({ where: { customerId }, orderBy: [{ createdAt: "desc" }, { productId: "asc" }], include: { product: { select: { ...catalogProductSelect(), vendorPublication: { select: { status: true, vendor: { select: { status: true } } } } } } } });
  return rows.map(({ product }) => {
    const available = product.isActive && (!product.vendorPublication || product.vendorPublication.status === "active" && product.vendorPublication.vendor.status === "approved");
    return { ...serializeProduct(product), available, stock: available ? product.stock : 0 };
  });
}