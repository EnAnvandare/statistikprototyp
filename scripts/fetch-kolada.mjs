// Hämtar biblioteksnyckeltal från Kolada (öppet API, ingen nyckel) och skriver data/kolada.csv.
//   npm run fetch:kolada
// OBS: skriptet är skrivet mot Kolada API v3 men kunde inte köras i miljön där det skapades.
// Kör det, och jämför sedan data/kolada.csv mot den tidigare versionen (git diff) innan du bygger.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCSV } from "./build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data/kolada.csv");
const API = "https://api.kolada.se/v3";

// Nyckeltal och kommuner som prototypen använder. Lägg till fler här.
export const KPIS = ["N09801", "N09807", "N09809", "N09810", "N09026", "N09805", "N09811"];
export const KOMMUNER = { "1280": "Malmö", "1285": "Eslöv", "1281": "Lund", "1283": "Helsingborg", "1480": "Göteborg", "0180": "Stockholm", "0380": "Uppsala" };
const FROM_YEAR = 2019;

// Plockar ut totalvärdet (gender "T") ur Koladas svar.
export function rowsFromKolada(json) {
  const out = [];
  for (const v of json.values || []) {
    const t = (v.values || []).find((x) => x.gender === "T");
    if (t && t.value != null) out.push({ kpi: v.kpi, municipality: v.municipality, period: Number(v.period), value: Number(t.value) });
  }
  return out;
}

async function getAll(url) {
  const rows = [];
  while (url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Kolada svarade ${r.status} för ${url}`);
    const json = await r.json();
    rows.push(...rowsFromKolada(json));
    url = json.next_url || null;
  }
  return rows;
}

async function main() {
  // Nyckeltalens namn: från API:t, annars från nuvarande fil.
  const names = {};
  if (fs.existsSync(OUT)) for (const r of parseCSV(fs.readFileSync(OUT, "utf8"))) names[r.kpi_id] ??= r.kpi;
  try {
    const r = await fetch(`${API}/kpi/${KPIS.join(",")}`);
    if (r.ok) for (const k of (await r.json()).values || []) if (k.id && k.title) names[k.id] = k.title;
  } catch {}

  const year = new Date().getFullYear();
  const years = Array.from({ length: year - FROM_YEAR + 1 }, (_, i) => FROM_YEAR + i).join(",");
  const rows = await getAll(`${API}/data/kpi/${KPIS.join(",")}/municipality/${Object.keys(KOMMUNER).join(",")}/year/${years}`);
  if (!rows.length) throw new Error("Inga rader kom tillbaka – kontrollera API:t innan du skriver över filen.");

  rows.sort((a, b) => a.kpi.localeCompare(b.kpi) || a.municipality.localeCompare(b.municipality) || a.period - b.period);
  const q = (s) => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);
  const lines = ["kpi_id,kpi,kommun_id,kommun,year,value",
    ...rows.map((r) => [r.kpi, q(names[r.kpi] || r.kpi), r.municipality, KOMMUNER[r.municipality] || r.municipality, r.period, Math.round(r.value * 1000) / 1000].join(","))];
  fs.writeFileSync(OUT, lines.join("\n") + "\n");
  console.log(`Skrev ${rows.length} rader till data/kolada.csv. Kör npm run build.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
