// Laddar src/core.js i Node, så att kommandoradsverktyget räknar med exakt samma kod som sidan.
// core.js är ett vanligt skript (inte en modul) som förväntar sig globala d3 och D.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildData } from "./build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadCore() {
  const context = vm.createContext({ console, Intl });
  // Samma d3-version som sidan laddar från cdnjs (7.9.0).
  vm.runInContext(fs.readFileSync(path.join(ROOT, "vendor/d3-7.9.0.min.js"), "utf8"), context, { filename: "d3.min.js" });
  const core = fs.readFileSync(path.join(ROOT, "src/core.js"), "utf8").replace("__DATA__", () => JSON.stringify(buildData()));
  return vm.runInContext(core + "\n;({ TOOLS, RULES, NOTES, BRANCHES, AREAS, BANDS, METRICS, LAST, FG, FY, REL_LABEL, assessReliability, futureRow });", context, { filename: "src/core.js" });
}
