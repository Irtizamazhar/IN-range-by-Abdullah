// Usage: node scripts/import-pakistan-cities.mjs path/to/cities1000.txt
// Source: https://download.geonames.org/export/dump/ (GeoNames, CC BY 4.0).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.argv[2]) throw new Error("Supply the extracted GeoNames cities1000.txt file.");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacy = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Gujranwala", "Hyderabad", "Abbottabad", "Bahawalpur", "Sargodha", "Mardan", "Sukkur", "Larkana", "Sheikhupura", "Rahim Yar Khan", "Jhang", "Taxila"];
const regional = ["Gilgit", "Skardu", "Hunza", "Aliabad", "Karimabad", "Chilas", "Gahkuch", "Khaplu", "Shigar", "Astore", "Gupis", "Danyor", "Jaglot", "Muzaffarabad", "Mirpur", "Rawalakot", "Bagh", "Bhimber", "Kotli", "Pallandri", "Athmuqam", "Hattian Bala", "Haveli", "Dadyal"];
const names = [...legacy, ...regional];
for (const line of fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/)) {
  const row = line.split("\t");
  if (row[8] === "PK" && row[6] === "P" && row[2]?.trim()) names.push(row[2].trim());
}
const unique = new Map();
const aliases = { "Athhmuqam": "Athmuqam", "Rawala Kot": "Rawalakot", "Attock City": "Attock", "Nawab Shah": "Nawabshah" };
for (const name of names) {
  const city = aliases[name] || name;
  const key = city.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!unique.has(key)) unique.set(key, city);
}
const cities = [...unique.values()].sort((a, b) => a.localeCompare(b, "en"));
fs.writeFileSync(path.join(root, "data/pakistan-cities.json"), JSON.stringify(cities, null, 2) + "\n");
console.log(`Wrote ${cities.length} unique Pakistan city/town names.`);
