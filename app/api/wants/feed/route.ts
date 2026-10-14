import { api, ApiError } from "@/lib/marketplace-api";
import { prisma } from "@/lib/prisma";
import { interestActivity, resolveWantViewer, wantEngagement } from "@/lib/want-engagement";
import {
  buildTrendingFindMany,
  buildWantsFeedFindMany,
  parseWantsFeedQuery,
  rankTrending,
  readTrendingOffset,
  toTrendingPage,
  toWantsFeedPage,
  WantsFeedInputError,
} from "@/lib/wants-feed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return api(async () => {
    try {
      const query = parseWantsFeedQuery(new URL(request.url).searchParams);
      const viewer = await resolveWantViewer();
      const accountTab = query.tab === "mine" || query.tab === "joined";
      if (accountTab && !viewer.customerId) {
        throw new ApiError(401, query.tab === "mine" ? "Please sign in as a customer to see your Wants." : "Please sign in as a customer to see the Wants you joined.");
      }
      const now = new Date();

      if (query.tab === "trending") {
        const offset = readTrendingOffset(query);
        const candidates = await prisma.want.findMany(buildTrendingFindMany(query, now));
        const ranked = rankTrending(candidates, await interestActivity(candidates.map(row => row.id), now), now);
        const slice = ranked.slice(offset, offset + query.limit);
        return toTrendingPage(ranked, query, offset, await wantEngagement(slice, viewer, now));
      }

      const customerId = accountTab ? viewer.customerId! : undefined;
      const rows = await prisma.want.findMany(buildWantsFeedFindMany(query, customerId, now));
      return toWantsFeedPage(rows, query, customerId, await wantEngagement(rows.slice(0, query.limit), viewer, now));
    } catch (error) {
      if (error instanceof WantsFeedInputError) throw new ApiError(400, error.message);
      throw error;
    }
  });
}
