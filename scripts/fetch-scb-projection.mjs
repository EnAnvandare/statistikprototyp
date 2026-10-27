// Hämtar SCB:s regionala befolkningsframskrivning (öppet API, ingen nyckel) och uppdaterar
// data/scb_proj.json, som framtidsvyn använder.
//   npm run fetch:scb
// Uppdaterar bara den aktuella framskrivningen (proj2024). Jämförelsen med 2022 års framskrivning
// (proj2022_malmo) lämnas orörd.
// OBS: skriptet kunde inte köras i miljön där det skapades. Kör det och granska ändringarna (git diff).
// När SCB publicerar en ny framskrivning byter tabellen id: ändra TABLE nedan och flytta den gamla
// framskrivningen till jämförelsen.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data/scb_proj.json");
const API = "https://api.scb.se/OV0104/v2beta/api/v2";
const TABLE = "TAB698"; // Framskrivning 2024: folkmängd m.m. efter region, kön och ålder
const REGIONS = { "1280": "Malmö", "1285": "Eslöv" };
const YEARS = [2025, 2030, 2035, 2040];

// Åldersgrupper som biblioteket planerar efter, byggda av SCB:s femårsklasser.
export const GROUPS = {
  "0–4 år": ["-4"],
  "5–14 år": ["5-9", "10-14"],
  "15–19 år": ["15-19"],
  "20–64 år": ["20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64"],
  "65–79 år": ["65-69", "70-74", "75-79"],
  "80+ år": ["80-84", "85-89", "90-94", "95-99", "100+"],
};

// Läser JSON-stat 2.0 (SCB:s standardformat) till en lista av {dimension: kod, …, value}.
export function fromJsonStat(js) {
  const ids = js.id, sizes = js.size;
  const codes = ids.map((d) => {
    const idx = js.dimension[d].category.index;
    return Array.isArray(idx) ? idx : Object.keys(idx).sort((a, b) => idx[a] - idx[b]);
  });
  const rows = [];
  const total = sizes.reduce((a, b) => a * b, 1);
  for (let n = 0; n < total; n++) {
    let rest = n; const row = {};
    for (let i = ids.length - 1; i >= 0; i--) { row[ids[i]] = codes[i][rest % sizes[i]]; rest = Math.floor(rest / sizes[i]); }
    const v = Array.isArray(js.value) ? js.value[n] : js.value[n] ?? null;
    row.value = v == null ? null : Number(v);
    rows.push(row);
  }
  return rows;
}

// Summerar till bibliotekets åldersgrupper: {kommun: {grupp: [värde per år]}}.
export function toGroups(rows) {
  const out = {};
  for (const [reg, name] of Object.entries(REGIONS)) {
    out[name] = {};
    for (const [g, classes] of Object.entries(GROUPS)) {
      out[name][g] = YEARS.map((y) => Math.round(rows
        .filter((r) => r.Region === reg && classes.includes(r.Alder) && Number(r.Tid) === y)
        .reduce((s, r) => s + (r.value || 0), 0)));
    }
  }
  return out;
}

async function main() {
  const q = new URLSearchParams({
    "valueCodes[ContentsCode]": "000004LG", // Folkmängd
    "valueCodes[Region]": Object.keys(REGIONS).join(","),
    "valueCodes[Kon]": "*",
    "valueCodes[Tid]": YEARS.join(","),
    "codelist[Alder]": "agg_Ålder5år",
    "valueCodes[Alder]": "*",
    outputFormat: "json-stat2",
  });
  const r = await fetch(`${API}/tables/${TABLE}/data?${q}`);
  if (!r.ok) throw new Error(`SCB svarade ${r.status}`);
  const proj = toGroups(fromJsonStat(await r.json()));
  if (!(proj["Malmö"]["20–64 år"][0] > 0)) throw new Error("Oväntat svar från SCB – filen skrevs inte över.");
  const cur = JSON.parse(fs.readFileSync(OUT, "utf8"));
  cur.years = YEARS; cur.groups = Object.keys(GROUPS); cur.proj2024 = proj;
  fs.writeFileSync(OUT, JSON.stringify(cur, null, 0));
  console.log("Uppdaterade data/scb_proj.json. Kör npm run build.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
