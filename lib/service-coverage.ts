import { z } from "zod";

export const locationProofSchema = z.object({ version: z.literal(2), providerId: z.string().min(1).max(512), sourceId: z.string().regex(/^osm:[nwr]:\d+$/), boundaryIds: z.array(z.string().regex(/^osm:[nwr]:\d+$/)).min(1).max(16), cityNames: z.array(z.string().min(1).max(200)).max(64), citySourceId: z.string().regex(/^osm:[nwr]:\d+$/).optional(), center: z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]).optional(), method: z.enum(["source-hierarchy", "boundary-membership"]) });
export const placeSchema = z.object({ id: z.string().min(1).max(512), name: z.string().min(1).max(200), label: z.string().max(500), kind: z.string().max(40), token: z.string().min(1).max(12000), proof: locationProofSchema.optional() });
export type ServicePlace = z.infer<typeof placeSchema>;
export const coverageSchema = z.array(z.object({ city: placeSchema, entireCity: z.boolean(), areas: z.array(placeSchema).max(50) })).min(1).max(20).superRefine((rows, ctx) => {
  const cities = new Set<string>();
  for (const row of rows) {
    if (cities.has(row.city.id)) ctx.addIssue({ code: "custom", message: "Duplicate city." });
    cities.add(row.city.id);
    if (!row.entireCity && !row.areas.length) ctx.addIssue({ code: "custom", message: "Choose specific areas or explicitly cover the entire city." });
    if (new Set(row.areas.map(a => a.id)).size !== row.areas.length || new Set(row.areas.map(a => a.name.toLocaleLowerCase().trim())).size !== row.areas.length) ctx.addIssue({ code: "custom", message: "Duplicate area." });
  }
});
export type ServiceCoverage = z.infer<typeof coverageSchema>;
export function readCoverage(value: unknown): ServiceCoverage {
  const parsed = coverageSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
export function coverageLabel(value: unknown, legacyCities?: unknown): string {
  const coverage = readCoverage(value);
  if (!coverage.length) return `${Array.isArray(legacyCities) ? legacyCities.join(", ") : "Legacy coverage"} — areas not verified; confirm availability`;
  const label = coverage.map(c => `${c.city.name}: ${c.entireCity ? "Entire city" : c.areas.map(a => a.name).join(", ")}`).join(" · ");
  return hasVerifiedCoverage(value) ? label : `${label} — geographic verification needs renewal`;
}
export function hasVerifiedCoverage(value: unknown): boolean {
  const rows = readCoverage(value);
  return !!rows.length && rows.every(row => row.city.proof?.version === 2 && row.city.id === row.city.proof.sourceId && row.areas.every(area => area.proof?.version === 2 && area.id === area.proof.sourceId && area.proof.citySourceId === row.city.id));
}
export function coversLocation(value: unknown, cityId: string, areaId?: string): boolean {
  return hasVerifiedCoverage(value) && readCoverage(value).some(c => c.city.id === cityId && (!areaId || c.entireCity || c.areas.some(a => a.id === areaId)));
}
/** Existing checkout has only a city. Never sell area-limited coverage as city-wide. */
export function supportsCityOnlyCheckout(value: unknown, city?: string): boolean {
  if (value == null) return true; // Historical city-only listings retain their existing contract.
  if (!hasVerifiedCoverage(value)) return false;
  const rows = readCoverage(value);
  return rows.some(row => row.entireCity && (!city || row.city.name.toLowerCase() === city.trim().toLowerCase()));
}
