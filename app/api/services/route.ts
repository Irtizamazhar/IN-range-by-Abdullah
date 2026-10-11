import { api } from "@/lib/marketplace-api";
import { publicServices } from "@/lib/public-services";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return api(async () => {
  const query = new URL(request.url).searchParams;
  const search = (query.get("search") || "").trim().slice(0, 100);
  const category = (query.get("category") || "").trim().slice(0, 100);
  const city = (query.get("city") || "").trim().slice(0, 100);
  const services = await publicServices({ search, category, city, take: 100 });
  return { services: services.map(({ price, ...service }) => ({ ...service, price: Number(price) })) };
}); }
