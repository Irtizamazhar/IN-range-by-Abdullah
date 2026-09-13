import { api } from "@/lib/marketplace-api";
import { publicStores } from "@/lib/store-service";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => ({ stores: await publicStores() })); }