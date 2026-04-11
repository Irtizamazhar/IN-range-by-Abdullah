import {
  ProductCard,
  type ProductCardData,
} from "@/components/user/ProductCard";

export function BestSellersSection({
  products,
}: {
  products: ProductCardData[];
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="bg-white py-14">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="text-center text-3xl font-black text-gray-900">
          Best Sellers
        </h2>
        <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-primaryYellow" />

        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              ribbon="BEST"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
