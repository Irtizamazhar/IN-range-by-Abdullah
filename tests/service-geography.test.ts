import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { administrativeMembership, corroboratesCity, isSourcePlace, matchesLocationQuery, normalizeLocationName, osmSourceId, type GeoProperties, type LocationProof } from "../lib/service-geography";
import { coverageLabel, hasVerifiedCoverage, readCoverage, coversLocation, supportsCityOnlyCheckout } from "../lib/service-coverage";
import { signPlace, validateCoverage, verifyLocationFilter, verifyPlace } from "../lib/service-locations";

const cityProof: LocationProof = { version: 2, providerId: "provider-city-lahore-fixture", sourceId: "osm:n:100", boundaryIds: ["osm:r:600"], cityNames: ["lahore", "لاہور"], method: "source-hierarchy" };
function source(name: string, place = "suburb", city = "Lahore"): GeoProperties {
  return { name, city, country_code: "pk", datasource: { sourcename: "openstreetmap", raw: { place, osm_id: 200, osm_type: "r", "name:en": name } } };
}
test("DHA fallback and merely similar area names are rejected; only source names/aliases match", () => {
  assert.equal(matchesLocationQuery("DHA", source("Walled City of Lahore")), false);
  assert.equal(matchesLocationQuery("Johar Town", source("Johar View")), false);
  assert.equal(matchesLocationQuery("Johar Town", source("Johar Avenue")), false);
  assert.equal(matchesLocationQuery("Johar Town", source("Johar Town")), true);
  assert.equal(matchesLocationQuery("Johar", source("Johar Town")), true);
  const dha = source("Defence Housing Authority"); dha.datasource!.raw!["short_name:en"] = "DHA";
  assert.equal(matchesLocationQuery("DHA", dha), true);
  assert.equal(matchesLocationQuery("DHA", source("Defence Housing Authority")), false);
  assert.equal(normalizeLocationName("Islāmābād"), normalizeLocationName("Islamabad"));
});
test("source classification excludes tehsils/divisions even when autocomplete calls them city", () => {
  assert.equal(isSourcePlace(source("Faisalabad", "city"), true), true);
  assert.equal(isSourcePlace(source("Wah Cantonment", "town"), true), true);
  for (const place of ["district", "county", "state", "municipality", "suburb"]) assert.equal(isSourcePlace(source("Karachi Division", place), true), false);
  assert.equal(isSourcePlace(source("Johar Town"), false), true);
  assert.equal(isSourcePlace({ name: "DHA", country_code: "pk" }, false), false);
  assert.equal(osmSourceId(source("DHA")), "osm:r:200");
});
test("exact parent association requires matching local geographic containment, never just names/province", () => {
  assert.equal(corroboratesCity(source("Johar Town"), ["osm:r:600"], cityProof), true);
  assert.equal(corroboratesCity(source("DHA EME Sector", "suburb", "Khanpur"), ["osm:r:600"], cityProof), false);
  assert.equal(corroboratesCity(source("Gulberg", "suburb", "Lahore Cant"), ["osm:r:600"], cityProof), false);
  assert.equal(corroboratesCity(source("DHA", "suburb", "Lahore"), ["osm:r:999"], cityProof), false);
  assert.equal(corroboratesCity(source("DHA", "suburb", ""), ["osm:r:600"], cityProof), false);
  assert.equal(corroboratesCity({ ...source("DHA"), country_code: "in" }, ["osm:r:600"], cityProof), false);
  assert.equal(corroboratesCity(source("Gulberg", "suburb", "Different provider label"), [cityProof.sourceId], cityProof), true);
  const feature = (admin_level: number, osm_id: number, country_code = "pk") => ({ properties: { country_code, datasource: { sourcename: "openstreetmap", raw: { boundary: "administrative", admin_level, osm_id, osm_type: "r" } } } });
  assert.deepEqual(administrativeMembership([feature(2, 1), feature(4, 2), feature(6, 600), feature(7, 700), feature(6, 999, "in")]), ["osm:r:600", "osm:r:700"]);
});
test("pre-fix signed selections remain readable but cannot become verified submissions or availability", () => {
  process.env.SERVICE_LOCATION_SECRET = "geographic-proof-isolated-test-secret-32-plus";
  const old = { id: "old-provider-city", name: "Saved city", label: "Saved city, Pakistan", kind: "city" };
  const payload = Buffer.from(JSON.stringify({ ...old, parentId: null, source: "geoapify", country: "pk" })).toString("base64url");
  const token = payload + "." + createHmac("sha256", process.env.SERVICE_LOCATION_SECRET).update(payload).digest("base64url");
  const city = { ...old, token }; const coverage = [{ city, entireCity: true, areas: [] }];
  assert.equal(readCoverage(coverage)[0].city.name, "Saved city");
  assert.equal(hasVerifiedCoverage(coverage), false); assert.equal(coversLocation(coverage, city.id), false);
  assert.equal(supportsCityOnlyCheckout(coverage, city.name), false); assert.equal(supportsCityOnlyCheckout(null), true);
  assert.match(coverageLabel(coverage), /needs renewal/);
  assert.throws(() => validateCoverage(coverage), /re-verification/);
  assert.throws(() => verifyLocationFilter(city.id, "", JSON.stringify(city)), /verified city/);
});
test("v2 signatures bind geographic evidence, city identity and multi-city coverage", () => {
  process.env.SERVICE_LOCATION_SECRET = "geographic-proof-isolated-test-secret-32-plus";
  const city = signPlace({ id: cityProof.sourceId, name: "Lahore", label: "Lahore fixture", kind: "city", proof: cityProof }, null);
  const areaProof: LocationProof = { version: 2, providerId: "provider-area-fixture", sourceId: "osm:r:200", boundaryIds: ["osm:r:600"], cityNames: [], citySourceId: city.id, method: "source-hierarchy" };
  const area = signPlace({ id: areaProof.sourceId, name: "Johar Town", label: "Johar Town fixture", kind: "suburb", proof: areaProof }, city.id);
  const otherProof: LocationProof = { ...cityProof, sourceId: "osm:n:300", providerId: "provider-other-city-fixture", boundaryIds: ["osm:r:900"], cityNames: ["islamabad"] };
  const other = signPlace({ id: otherProof.sourceId, name: "Islamabad", label: "Islamabad fixture", kind: "city", proof: otherProof }, null);
  const coverage = [{ city, entireCity: false, areas: [area] }, { city: other, entireCity: true, areas: [] }];
  assert.equal(validateCoverage(coverage).length, 2); assert.equal(coversLocation(coverage, city.id, area.id), true);
  assert.equal(coversLocation(coverage, city.id, "wrong-area"), false); assert.equal(coversLocation(coverage, other.id, "any-area"), true);
  assert.throws(() => validateCoverage([{ city: other, entireCity: false, areas: [area] }]), /does not belong/);
  assert.throws(() => verifyPlace({ ...area, proof: { ...areaProof, boundaryIds: ["osm:r:999"] } }, city.id), /re-verification/);
});
test("short signing secrets fail closed instead of issuing weak attestations", () => {
  const previous = process.env.SERVICE_LOCATION_SECRET; process.env.SERVICE_LOCATION_SECRET = "short";
  try { assert.throws(() => signPlace({ id: cityProof.sourceId, name: "Lahore", label: "fixture", kind: "city", proof: cityProof }, null), /at least 32/); }
  finally { process.env.SERVICE_LOCATION_SECRET = previous; }
});
