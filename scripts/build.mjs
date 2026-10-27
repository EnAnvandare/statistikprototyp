// Bygger dist/index.html: en enda fristående HTML-fil (krav för Claude-artefakter).
// Läser src/index.html, src/styles.css, src/llm-shim.js, src/core.js, src/app.js och allt i data/.
//   node scripts/build.mjs            → dist/index.html
//   node scripts/build.mjs --watch    → bygger om vid varje ändring i src/ eller data/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...a) => path.join(ROOT, ...a);
const read = (f) => fs.readFileSync(p(f), "utf8");

// Minimal CSV-läsare som klarar citerade fält med kommatecken.
export function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some((v) => v !== "")) rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, ""), r[i]])));
}
const num = (v) => Number(v);

export function buildData() {
  const csv = (f) => parseCSV(read(path.join("data", f)));
  const bm = csv("branch_month.csv").map((r) => [r.month, r.branch, r.stadsomrade, num(r.loans_physical), num(r.loans_children), num(r.visits), num(r.events), num(r.event_participants), num(r.open_hours)]);
  const dig = csv("digital_month.csv").map((r) => [r.month, num(r.eloans_ebook), num(r.eloans_audiobook), num(r.web_sessions), num(r.catalogue_searches)]);
  const ab = csv("active_borrowers.csv").map((r) => [num(r.year), r.stadsomrade, r.age_band, num(r.active_borrowers)]);
  const pop = csv("area_population_example.csv").map((r) => [r.stadsomrade, r.age_band, num(r.population)]);
  const kolRows = csv("kolada.csv");
  const kol = kolRows.map((r) => [r.kpi_id, r.kommun, num(r.year), num(r.value)]);
  const kolNames = {};
  for (const r of kolRows) if (!(r.kpi_id in kolNames)) kolNames[r.kpi_id] = r.kpi;
  const { _source, ...popTotal } = JSON.parse(read("data/kommun_population.json"));
  const proj = JSON.parse(read("data/scb_proj.json"));
  return { bm, dig, ab, pop, kol, kolNames, popTotal, proj };
}

export function build() {
  const data = JSON.stringify(buildData());
  const core = read("src/core.js").replace("__DATA__", () => data);
  const app = read("src/app.js");
  const shim = read("src/llm-shim.js");
  const html = read("src/index.html")
    .replace("<!-- @styles.css -->", () => "\n" + read("src/styles.css"))
    .replace("<!-- @app.js -->", () => "\n" + shim + "\n" + core + "\n" + app);
  fs.mkdirSync(p("dist"), { recursive: true });
  fs.writeFileSync(p("dist/index.html"), html);
  return html.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const run = () => { try { console.log(`Byggde dist/index.html (${Math.round(build() / 1024)} kB)`); } catch (e) { console.error("Bygget misslyckades:", e.message); } };
  run();
  if (process.argv.includes("--watch")) {
    let t; const again = () => { clearTimeout(t); t = setTimeout(run, 100); };
    for (const d of ["src", "data"]) fs.watch(p(d), again);
    console.log("Bevakar src/ och data/ …");
  }
}
