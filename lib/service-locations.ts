import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/marketplace-api";
import { coverageSchema, locationProofSchema, type ServiceCoverage, type ServicePlace } from "@/lib/service-coverage";
import { administrativeMembership, corroboratesCity, isSourcePlace, matchesLocationQuery, normalizeLocationName, osmSourceId, sourceNames, type GeoFeature, type GeoProperties, type LocationProof } from "@/lib/service-geography";

function secret() {
  const key = process.env.SERVICE_LOCATION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!key || key.trim().length < 32) throw new ApiError(503, "A stable location signing secret of at least 32 characters is required.");
  return key;
}
function canonicalProof(proof: LocationProof) {
  return JSON.stringify({ version: proof.version, providerId: proof.providerId, sourceId: proof.sourceId, boundaryIds: [...proof.boundaryIds].sort(), cityNames: [...proof.cityNames].sort(), citySourceId: proof.citySourceId || null, center: proof.center || null, method: proof.method });
}
export function signPlace(place: Omit<ServicePlace, "token">, parentId: string | null): ServicePlace {
  const proof = locationProofSchema.parse(place.proof);
  if (place.id !== proof.sourceId || (parentId ? proof.citySourceId !== parentId : !!proof.citySourceId)) throw new ApiError(400, "Invalid geographic proof.");
  const payload = Buffer.from(JSON.stringify({ id: place.id, name: place.name, label: place.label, kind: place.kind, proof: canonicalProof(proof), parentId, source: "geoapify", country: "pk" })).toString("base64url");
  return { ...place, proof, token: payload + "." + createHmac("sha256", secret()).update(payload).digest("base64url") };
}
export function verifyPlace(place: ServicePlace, parentId: string | null) {
  const [payload, signature, extra] = place.token.split(".");
  if (!payload || !signature || extra) throw new ApiError(400, "Select a verified location from search.");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ApiError(400, "Location verification failed. Search again.");
  let data;
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { throw new ApiError(400, "Invalid location."); }
  if (data.parentId !== parentId || data.country !== "pk" || data.source !== "geoapify" || ["id", "name", "label", "kind"].some(k => data[k] !== place[k as keyof ServicePlace])) throw new ApiError(400, "Area does not belong to the selected city or location was altered.");
  const parsed = locationProofSchema.safeParse(place.proof);
  if (!parsed.success || place.id !== parsed.data.sourceId || data.proof !== canonicalProof(parsed.data)) throw new ApiError(400, "Saved location needs geographic re-verification. Its original coverage has been preserved.");
  if (parentId ? parsed.data.citySourceId !== parentId : !!parsed.data.citySourceId) throw new ApiError(400, "Area does not belong to the selected city.");
}
export function validateCoverage(value: unknown): ServiceCoverage {
  const rows = coverageSchema.parse(value);
  for (const row of rows) {
    verifyPlace(row.city, null);
    for (const area of row.areas) {
      verifyPlace(area, row.city.id);
      if (!area.proof!.boundaryIds.some(id => id === row.city.id || row.city.proof!.boundaryIds.includes(id))) throw new ApiError(400, "Area containment proof does not match this city.");
    }
  }
  return rows.map(row => ({ ...row, areas: row.entireCity ? [] : row.areas }));
}
export function verifyLocationFilter(cityId: string, areaId: string, citySelection?: string | null, areaSelection?: string | null) {
  if (!cityId && !areaId) return;
  try {
    const city = JSON.parse(citySelection || "null") as ServicePlace; verifyPlace(city, null);
    if (city.id !== cityId) throw new Error("City mismatch");
    if (areaId) { const area = JSON.parse(areaSelection || "null") as ServicePlace; verifyPlace(area, city.id); if (area.id !== areaId) throw new Error("Area mismatch"); }
  } catch { throw new ApiError(400, "Select a verified city and an area belonging to that city."); }
}
export function eligiblePlace(row: GeoProperties, city?: ServicePlace, query?: string): boolean {
  if (row.country_code !== "pk" || !row.place_id || !row.formatted || (query && !matchesLocationQuery(query, row))) return false;
  return (city ? ["suburb", "neighbourhood", "quarter"] : ["city", "town", "village"]).includes(row.result_type || "");
}
// All provider endpoints share a bounded cache, in-flight deduplication and quota.
const cache = new Map<string, { expires: number; data: unknown }>();
const pending = new Map<string, Promise<unknown>>();
let nextRequestAt = 0, dayStart = 0, dayCredits = 0;
function dailyLimit() {
  const limit = Number(process.env.SERVICE_LOCATION_DAILY_LIMIT || 2500);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new ApiError(503, "Location request budget is misconfigured.");
  return limit;
}
async function providerGet<T>(path: string, input: Record<string, string>, ttl = 86400000): Promise<T> {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  if (!key) throw new ApiError(503, "Verified location search is not configured. Request a location review.");
  const cacheKey = path + new URLSearchParams(input).toString();
  const hit = cache.get(cacheKey); if (hit && hit.expires > Date.now()) return hit.data as T;
  if (pending.has(cacheKey)) return pending.get(cacheKey) as Promise<T>;
  const request = (async () => {
    const now = Date.now(); if (now - dayStart >= 86400000) { dayStart = now; dayCredits = 0; }
    // details.names costs an extra credit. Keep the budget in credits, not just request count.
    const credits = input.features?.includes("details.names") ? 2 : 1;
    if (dayCredits + credits > dailyLimit() || nextRequestAt - now > 3000) throw new ApiError(429, "Location search is busy. Please retry shortly.");
    dayCredits += credits;
    const at = Math.max(now, nextRequestAt); nextRequestAt = at + 300;
    if (at > now) await new Promise(resolve => setTimeout(resolve, at - now));
    let response: Response;
    try { response = await fetch(`https://api.geoapify.com/${path}?${new URLSearchParams({ ...input, apiKey: key })}`, { cache: "no-store", signal: AbortSignal.timeout(10000) }); } catch { throw new ApiError(503, "Location provider unavailable. Saved coverage is unchanged; try later."); }
    if (!response.ok) throw new ApiError(response.status === 429 ? 429 : 503, "Location provider unavailable. Please retry later.");
    let data: unknown;
    try { data = await response.json(); } catch { throw new ApiError(503, "Location provider returned an invalid response."); }
    if (cache.size >= 600) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { expires: Date.now() + ttl, data }); return data;
  })();
  pending.set(cacheKey, request); try { return await request as T; } finally { pending.delete(cacheKey); }
}
async function sourceEvidence(providerId: string) {
  const data = await providerGet<{ features?: GeoFeature[] }>("v2/place-details", { id: providerId, features: "details,details.names", lang: "en" });
  const row = data.features?.find(f => f.properties?.feature_type === "details")?.properties || data.features?.[0]?.properties;
  if (!row || row.country_code !== "pk") return null;
  const membership = await providerGet<{ features?: GeoFeature[] }>("v1/boundaries/part-of", { id: providerId, geometry: "point", lang: "en" });
  const center: [number, number] | undefined = Number.isFinite(row.lon) && Number.isFinite(row.lat) ? [row.lon!, row.lat!] : undefined;
  return { row, center, boundaries: administrativeMembership(membership.features || []) };
}
export async function searchServiceLocations(query: string, city?: ServicePlace): Promise<ServicePlace[]> {
  secret(); if (city) verifyPlace(city, null);
  const providerCityId = city?.proof?.providerId;
  // A populated-place node has no municipal polygon; place filters can be approximate.
  // Use its coordinates only to rank candidates. Authoritative source membership below
  // decides acceptance, never proximity or an invented bounding box/radius.
  const center = city?.proof?.center;
  const data = await providerGet<{ results?: GeoProperties[] }>("v1/geocode/autocomplete", { text: query, type: city ? "locality" : "city", filter: providerCityId && !center ? `countrycode:pk|place:${providerCityId}` : "countrycode:pk", ...(center ? { bias: `proximity:${center[0]},${center[1]}` } : {}), lang: "en", limit: "10", format: "json" }, 15 * 60000);
  // Autocomplete can omit a legitimate alias exposed by Place Details. Only the detailed
  // source names decide relevance; this first pass screens country and result type.
  const candidates = (data.results || []).filter(row => eligiblePlace(row, city)).slice(0, 5);
  const rows: ServicePlace[] = [], seen = new Set<string>();
  for (const candidate of candidates) {
    const evidence = await sourceEvidence(candidate.place_id!);
    if (!evidence || !evidence.center || !isSourcePlace(evidence.row, !city) || !matchesLocationQuery(query, evidence.row) || !evidence.boundaries.length) continue;
    const sourceId = osmSourceId(evidence.row)!;
    if (seen.has(sourceId)) continue;
    if (city && !corroboratesCity(evidence.row, evidence.boundaries, city.proof!)) continue;
    const name = candidate.name || (city ? candidate.suburb || candidate.neighbourhood || candidate.quarter : candidate.city || candidate.town || candidate.village);
    if (!name || !sourceNames(evidence.row).includes(normalizeLocationName(name))) continue;
    const cityNames = city ? [] : Array.from(new Set([normalizeLocationName(name), normalizeLocationName(evidence.row.name || ""), normalizeLocationName(evidence.row.name_international?.en || ""), ...sourceNames(evidence.row).slice(0, 12)])).filter(Boolean);
    const proof: LocationProof = { version: 2, providerId: candidate.place_id!, sourceId, boundaryIds: evidence.boundaries, cityNames, center: evidence.center, ...(city ? { citySourceId: city.id } : {}), method: city && evidence.boundaries.includes(city.id) ? "boundary-membership" : "source-hierarchy" };
    rows.push(signPlace({ id: sourceId, name, label: candidate.formatted!, kind: String(evidence.row.datasource!.raw!.place), proof }, city?.id || null)); seen.add(sourceId);
  }
  // Identically named places within the same geographic envelope cannot be resolved by this
  // source hierarchy. Do not let the user accidentally choose one as the other's parent.
  return rows.filter(row => rows.filter(other => normalizeLocationName(other.name) === normalizeLocationName(row.name) && other.proof!.boundaryIds.some(id => row.proof!.boundaryIds.includes(id))).length === 1);
}
