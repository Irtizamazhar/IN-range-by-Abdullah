import { api, ApiError, customerActor } from "@/lib/marketplace-api";
import { prisma } from "@/lib/prisma";
import {
  buildWantsFeedFindMany,
  parseWantsFeedQuery,
  toWantsFeedPage,
  WantsFeedInputError,
} from "@/lib/wants-feed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return api(async () => {
    try {
      const query = parseWantsFeedQuery(new URL(request.url).searchParams);
      const customerId = query.tab === "mine" ? (await customerActor()).id : undefined;
      const rows = await prisma.want.findMany(buildWantsFeedFindMany(query, customerId));
      return toWantsFeedPage(rows, query, customerId);
    } catch (error) {
      if (error instanceof WantsFeedInputError) throw new ApiError(400, error.message);
      throw error;
    }
  });
}
