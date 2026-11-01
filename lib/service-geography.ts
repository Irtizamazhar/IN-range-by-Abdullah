/** Pure checks over Geoapify/OpenStreetMap evidence. Never infer a city from proximity. */
export type GeoProperties = {
  feature_type?: string;
  lon?: number; lat?: number;
  name?: string; formatted?: string; country_code?: string; city?: string; town?: string;
  village?: string; suburb?: string; neighbourhood?: string; quarter?: string;
  place_id?: string; result_type?: string; category?: string;
  name_international?: Record<string, string>; name_other?: Record<string, string>;
  other_names?: Record<string, string>;
  datasource?: { sourcename?: string; raw?: Record<string, unknown> };
};
export type GeoFeature = { properties?: GeoProperties; geometry?: { type?: string; coordinates?: unknown } };
export type LocationProof = {
  version: 2; providerId: string; sourceId: string; boundaryIds: string[];
  cityNames: string[]; citySourceId?: string; method: "source-hierarchy" | "boundary-membership";
  center?: [number, number];
};
export function normalizeLocationName(value: string): string {
  return value.normalize("NFKD").replace(new RegExp("\\p{M}", "gu"), "").toLocaleLowerCase("en")
    .replace(new RegExp("[^\\p{L}\\p{N}]+", "gu"), " ").trim().replace(/\s+/g, " ");
}
export function sourceNames(row: GeoProperties): string[] {
  const raw = row.datasource?.raw || {};
  const names: string[] = [row.name || ""];
  for (const map of [row.other_names, row.name_international, row.name_other]) if (map) names.push(...Object.values(map));
  for (const [key, value] of Object.entries(raw)) if (/^(?:name|alt_name|short_name|official_name)(?::.*)?$/.test(key) && typeof value === "string") names.push(value);
  return Array.from(new Set(names.flatMap(name => name.split(";")).map(normalizeLocationName).filter(Boolean)));
}
export function matchesLocationQuery(query: string, row: GeoProperties): boolean {
  const q = normalizeLocationName(query);
  // Autocomplete prefix, not edit-distance/fuzzy similarity. Aliases must come from the source.
  return q.length >= 2 && sourceNames(row).some(name => name.startsWith(q));
}
export function osmSourceId(row: GeoProperties): string | null {
  const raw = row.datasource?.raw;
  if (row.datasource?.sourcename !== "openstreetmap" || !raw) return null;
  const type = ({ node: "n", way: "w", relation: "r", n: "n", w: "w", r: "r" } as Record<string, string>)[String(raw.osm_type)];
  return type && /^\d+$/.test(String(raw.osm_id)) ? `osm:${type}:${raw.osm_id}` : null;
}
export function isSourcePlace(row: GeoProperties, city: boolean): boolean {
  const kind = String(row.datasource?.raw?.place || "");
  return row.country_code === "pk" && !!osmSourceId(row) &&
    (city ? ["city", "town", "village"] : ["suburb", "neighbourhood", "quarter"]).includes(kind);
}
export function administrativeMembership(features: GeoFeature[]): string[] {
  return Array.from(new Set(features.flatMap(feature => {
    const p = feature.properties, raw = p?.datasource?.raw;
    const level = Number(raw?.admin_level);
    const id = p ? osmSourceId(p) : null;
    // Province/country overlap is not useful proof of local membership.
    return p?.country_code === "pk" && raw?.boundary === "administrative" && level >= 6 && level <= 10 && id ? [id] : [];
  }))).sort();
}
export function corroboratesCity(area: GeoProperties, areaBoundaries: string[], city: LocationProof): boolean {
  if (area.country_code !== "pk") return false;
  // A direct city boundary identity is authoritative. Otherwise require BOTH the source's
  // exact city association and matching local administrative containment IDs.
  if (areaBoundaries.includes(city.sourceId)) return true;
  const parent = normalizeLocationName(area.city || area.town || area.village || "");
  return !!parent && city.cityNames.includes(parent) && areaBoundaries.some(id => city.boundaryIds.includes(id));
}
