// Ställ frågor till biblioteksdatan från kommandoraden – med samma verktyg och
// tillförlitlighetsregler som AI-panelen på sidan. Byggt för att Claude Code ska använda det,
// men fungerar lika bra för människor.
//
//   node scripts/fraga.mjs verktyg                      lista verktygen och deras parametrar
//   node scripts/fraga.mjs regler                       visa reglerna som AI-panelen följer
//   node scripts/fraga.mjs <verktyg> nyckel=värde …     kör ett verktyg
//   node scripts/fraga.mjs <verktyg> '{"json": …}'      samma sak med JSON
//   echo '{…}' | node scripts/fraga.mjs <verktyg> -     JSON från stdin
//
// Listor skrivs med kommatecken: group_by=year,branch  months_of_year=1,2,3
// Exempel:
//   node scripts/fraga.mjs query_library_activity metrics=visits group_by=month branches=Lindängenbiblioteket from=2026-01 to=2026-04
//   node scripts/fraga.mjs check_reliability kind=change before=12571 after=3853 branch=Lindängenbiblioteket metric=visits example_data=true
import { loadCore } from "./core-node.mjs";

process.stdout.on("error", (e) => { if (e.code === "EPIPE") process.exit(0); throw e; });
const core = loadCore();
const [cmd, ...args] = process.argv.slice(2);
const out = (v) => process.stdout.write((typeof v === "string" ? v : JSON.stringify(v, null, 2)) + "\n");
const die = (msg) => { process.stderr.write("Fel: " + msg + "\n"); process.exit(1); };

function describeSchema(schema) {
  const props = schema?.properties || {};
  const req = new Set(schema?.required || []);
  return Object.entries(props).map(([k, p]) => {
    const type = p.type === "array" ? `lista av ${p.items?.type || "värden"}` : p.type || "värde";
    const choices = p.enum || p.items?.enum;
    return `    ${k}${req.has(k) ? " (krävs)" : ""}: ${type}${choices ? " – " + choices.join(", ") : ""}${p.description ? " – " + p.description : ""}`;
  }).join("\n");
}

function coerce(value, prop) {
  const one = (v, t) => (t === "integer" || t === "number" ? Number(v) : t === "boolean" ? v === "true" : v);
  if (!prop) return value;
  if (prop.type === "array") return value === "" ? [] : value.split(",").map((v) => one(v.trim(), prop.items?.type));
  if (prop.type === "object") return JSON.parse(value);
  return one(value, prop.type);
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

if (!cmd || cmd === "hjälp" || cmd === "help" || cmd === "-h" || cmd === "--help") {
  out(`Användning:
  node scripts/fraga.mjs verktyg                   lista verktygen
  node scripts/fraga.mjs regler                    visa analysreglerna
  node scripts/fraga.mjs <verktyg> nyckel=värde …  kör ett verktyg (listor med kommatecken)
  node scripts/fraga.mjs <verktyg> '{"json":…}'    kör ett verktyg med JSON

Bibliotek: ${core.BRANCHES.join(", ")}
Stadsområden: ${core.AREAS.join(", ")}   Senaste månad: ${core.LAST}`);
} else if (cmd === "verktyg" || cmd === "tools") {
  for (const t of core.TOOLS) out(`${t.name}\n  ${t.description}\n${describeSchema(t.inputSchema) || "    (inga parametrar)"}\n`);
} else if (cmd === "regler" || cmd === "rules") {
  out(core.RULES);
} else {
  const tool = core.TOOLS.find((t) => t.name === cmd);
  if (!tool) die(`okänt verktyg "${cmd}". Kör "node scripts/fraga.mjs verktyg" för en lista.`);
  let input = {};
  try {
    if (args[0] === "-") input = JSON.parse(await readStdin());
    else if (args[0]?.trim().startsWith("{")) input = JSON.parse(args.join(" "));
    else for (const a of args) {
      const i = a.indexOf("=");
      if (i < 1) die(`"${a}" är inte på formen nyckel=värde`);
      const key = a.slice(0, i), props = tool.inputSchema?.properties || {};
      if (!(key in props)) die(`"${key}" är ingen parameter till ${cmd}. Giltiga: ${Object.keys(props).join(", ") || "inga"}`);
      input[key] = coerce(a.slice(i + 1), props[key]);
    }
  } catch (e) { die("kunde inte läsa indata: " + e.message); }
  try { out(await tool.execute(input, {})); }
  catch (e) { die(e.message); }
}
